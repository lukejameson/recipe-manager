import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { collectionRecipes, collections } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// POST /api/collections/[id]/recipes - Add recipe to collection
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({ recipeId: z.string() });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { recipeId } = result.data;
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, params.id), eq(collections.userId, user.userId)))
      .limit(1);
    if (!collection) {
      throw error(404, 'Collection not found');
    }
    const [existing] = await db
      .select()
      .from(collectionRecipes)
      .where(and(
        eq(collectionRecipes.collectionId, params.id),
        eq(collectionRecipes.recipeId, recipeId)
      ))
      .limit(1);

    if (existing) {
      throw error(409, 'Recipe already in collection');
    }

    await db.insert(collectionRecipes).values({
      collectionId: params.id,
      recipeId,
    });

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Add recipe to collection error:', e);
    throw error(500, 'Internal server error');
  }
};
