import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, recipeComponents } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/recipes/[id]/hierarchy - Get recipe component hierarchy
 */
export const GET: RequestHandler = async ({ params, cookies }) => {
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

    // Get components with their details
    const components = await db
      .select({
        id: recipeComponents.id,
        childRecipeId: recipeComponents.childRecipeId,
        servingsNeeded: recipeComponents.servingsNeeded,
        sortOrder: recipeComponents.sortOrder,
        childRecipe: {
          id: recipes.id,
          title: recipes.title,
          servings: recipes.servings,
        },
      })
      .from(recipeComponents)
      .leftJoin(recipes, eq(recipeComponents.childRecipeId, recipes.id))
      .where(eq(recipeComponents.parentRecipeId, params.id))
      .orderBy(recipeComponents.sortOrder);

    return json(components);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get recipe hierarchy error:', e);
    throw error(500, 'Internal server error');
  }
};
