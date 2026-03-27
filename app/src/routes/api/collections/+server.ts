import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { collections, collectionRecipes, recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/collections - List all collections
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const allCollections = await db
      .select()
      .from(collections)
      .where(eq(collections.userId, user.userId));

    // Get recipe counts for each collection
    const collectionsWithCounts = await Promise.all(
      allCollections.map(async (collection) => {
        const recipeCount = await db
          .select()
          .from(collectionRecipes)
          .where(eq(collectionRecipes.collectionId, collection.id));

        return {
          ...collection,
          recipeCount: recipeCount.length,
        };
      })
    );

    return json(collectionsWithCounts);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List collections error:', e);
    throw error(500, 'Internal server error');
  }
};

// POST /api/collections - Create a new collection
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
