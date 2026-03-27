import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { tags, recipeTags, recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, sql, and } from 'drizzle-orm';

// GET /api/tags/collections - List tags as collections (tags with 2+ recipes)
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const tagCollections = await db
      .select({
        id: tags.id,
        name: tags.name,
        description: sql<string>`'Recipes tagged with ' || ${tags.name}`,
        recipeCount: sql<number>`count(${recipeTags.recipeId})`,
      })
      .from(tags)
      .innerJoin(recipeTags, eq(tags.id, recipeTags.tagId))
      .where(eq(tags.userId, user.userId))
      .groupBy(tags.id)
      .having(sql`count(${recipeTags.recipeId}) >= 2`)
      .orderBy(tags.name);

    return json(tagCollections);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List tag collections error:', e);
    throw error(500, 'Internal server error');
  }
};
