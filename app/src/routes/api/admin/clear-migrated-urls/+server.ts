import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { db } from '$lib/server/db/db';
import { recipes } from '$lib/server/db/schema';
import { isNotNull, and, eq, isNull } from 'drizzle-orm';

export const POST: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!user.isAdmin) {
      throw error(403, 'Admin access required');
    }

    const recipeId = url.searchParams.get('recipeId');
    const clearAll = url.searchParams.get('clearAll') === 'true';

    let cleared = 0;

    if (clearAll) {
      const result = await db.update(recipes)
        .set({ imageUrl: null })
        .where(and(
          isNotNull(recipes.imageUrl),
          eq(recipes.userId, user.userId)
        ));
      cleared = result.rowCount || 0;
    } else if (recipeId) {
      await db.update(recipes)
        .set({ imageUrl: null })
        .where(and(
          eq(recipes.id, recipeId),
          isNotNull(recipes.imageUrl),
          eq(recipes.userId, user.userId)
        ));
      cleared = 1;
    }

    return json({ success: true, cleared });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Clear migrated URLs error:', e);
    throw error(500, 'Internal server error');
  }
};
