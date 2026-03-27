import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, recipeComponents } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/recipes/[id]/nutrition - Get aggregated nutrition for a recipe including components
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

    // Get components with their nutrition
    const components = await db
      .select({
        component: recipeComponents,
        childRecipe: recipes,
      })
      .from(recipeComponents)
      .innerJoin(recipes, eq(recipeComponents.childRecipeId, recipes.id))
      .where(eq(recipeComponents.parentRecipeId, params.id));

    // Calculate aggregated nutrition
    let aggregated = recipe.nutrition ? { ...recipe.nutrition } : null;

    if (components.length > 0) {
      const baseServings = recipe.servings || 1;

      for (const { component, childRecipe } of components) {
        if (!childRecipe.nutrition) continue;

        const compServings = component.servingsNeeded || 1;
        const ratio = compServings / baseServings;

        if (!aggregated) {
          aggregated = { ...childRecipe.nutrition };
        } else {
          aggregated.calories = (aggregated.calories || 0) + ((childRecipe.nutrition.calories || 0) * ratio);
          aggregated.protein = (aggregated.protein || 0) + ((childRecipe.nutrition.protein || 0) * ratio);
          aggregated.carbohydrates = (aggregated.carbohydrates || 0) + ((childRecipe.nutrition.carbohydrates || 0) * ratio);
          aggregated.fat = (aggregated.fat || 0) + ((childRecipe.nutrition.fat || 0) * ratio);
          aggregated.saturatedFat = (aggregated.saturatedFat || 0) + ((childRecipe.nutrition.saturatedFat || 0) * ratio);
          aggregated.fiber = (aggregated.fiber || 0) + ((childRecipe.nutrition.fiber || 0) * ratio);
          aggregated.sugar = (aggregated.sugar || 0) + ((childRecipe.nutrition.sugar || 0) * ratio);
          aggregated.sodium = (aggregated.sodium || 0) + ((childRecipe.nutrition.sodium || 0) * ratio);
          aggregated.cholesterol = (aggregated.cholesterol || 0) + ((childRecipe.nutrition.cholesterol || 0) * ratio);
        }
      }
    }

    return json({
      recipeId: params.id,
      nutrition: aggregated,
      hasComponents: components.length > 0,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get aggregated nutrition error:', e);
    throw error(500, 'Internal server error');
  }
};
