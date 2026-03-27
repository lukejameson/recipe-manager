import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const ratingSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/recipes/[id]/rating - Update recipe rating
 */
export const POST: RequestHandler = async ({ params, request, cookies }) => {
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

    const body = await request.json();
    const result = ratingSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const data = result.data;

    // Update rating
    const [updated] = await db
      .update(recipes)
      .set({
        rating: data.rating !== undefined ? data.rating : recipe.rating,
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, params.id))
      .returning();

    return json({
      success: true,
      rating: updated.rating,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update rating error:', e);
    throw error(500, 'Internal server error');
  }
};
