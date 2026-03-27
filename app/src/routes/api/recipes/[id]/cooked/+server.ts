import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/recipes/[id]/cooked - Mark recipe as cooked (increments timesCooked)
 */
export const POST: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Check recipe exists and belongs to user
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.userId, user.userId)))
      .limit(1);

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    // Increment times cooked and update last cooked date
    const [updated] = await db
      .update(recipes)
      .set({
        timesCooked: (recipe.timesCooked || 0) + 1,
        lastCookedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, params.id))
      .returning();

    return json({
      success: true,
      timesCooked: updated.timesCooked,
      lastCookedAt: updated.lastCookedAt,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Mark as cooked error:', e);
    throw error(500, 'Internal server error');
  }
};
