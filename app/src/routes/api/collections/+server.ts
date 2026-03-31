import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { collections, collectionRecipes, recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const collectionsWithCounts = await db
      .select({
        id: collections.id,
        userId: collections.userId,
        name: collections.name,
        description: collections.description,
        createdAt: collections.createdAt,
        recipeCount: sql<number>`COUNT(${collectionRecipes.recipeId})`.as('recipeCount'),
      })
      .from(collections)
      .leftJoin(collectionRecipes, eq(collections.id, collectionRecipes.collectionId))
      .where(eq(collections.userId, user.userId))
      .groupBy(collections.id)
      .orderBy(collections.name);
    return json(collectionsWithCounts);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List collections error:', e);
    throw error(500, 'Internal server error');
  }
  };
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const [newCollection] = await db
      .insert(collections)
      .values({ ...result.data, userId: user.userId })
      .returning();

    return json({ ...newCollection, recipeCount: 0 });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Create collection error:', e);
    throw error(500, 'Internal server error');
  }
};
