import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { tags, recipeTags, recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, sql, and } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/tags - List all tags with recipe counts
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const allTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        createdAt: tags.createdAt,
        recipeCount: sql<number>`cast(count(${recipeTags.recipeId}) as integer)`,
      })
      .from(tags)
      .leftJoin(recipeTags, eq(tags.id, recipeTags.tagId))
      .where(eq(tags.userId, user.userId))
      .groupBy(tags.id)
      .orderBy(tags.name);

    return json(allTags);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List tags error:', e);
    throw error(500, 'Internal server error');
  }
};

// POST /api/tags - Create a new tag
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({ name: z.string().min(1).max(50) });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { name } = result.data;

    // Check if tag already exists
    const [existing] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.name, name), eq(tags.userId, user.userId)))
      .limit(1);

    if (existing) {
      throw error(409, 'Tag already exists');
    }

    const [newTag] = await db
      .insert(tags)
      .values({ name, userId: user.userId })
      .returning();

    return json({ ...newTag, recipeCount: 0 });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Create tag error:', e);
    throw error(500, 'Internal server error');
  }
};
