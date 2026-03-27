import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { collectionRecipes, collections } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

// DELETE /api/collections/[id]/recipes/[recipeId] - Remove recipe from collection
export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Verify collection belongs to user
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, params.id), eq(collections.userId, user.userId)))
      .limit(1);

    if (!collection) {
      throw error(404, 'Collection not found');
    }

    await db
      .delete(collectionRecipes)
      .where(and(
        eq(collectionRecipes.collectionId, params.id),
        eq(collectionRecipes.recipeId, params.recipeId)
      ));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Remove recipe from collection error:', e);
    throw error(500, 'Internal server error');
  }
};
