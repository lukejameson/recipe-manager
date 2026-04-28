import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, tags, recipeTags } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { normalizeRecipeData } from '$lib/utils/recipe-helpers';

export const GET: RequestHandler = async ({ params }) => {
  try {
    if (!params.token) {
      throw error(400, 'Share token is required');
    }

    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.shareToken, params.token), eq(recipes.isShared, true)))
      .limit(1);

    if (!recipe) {
      throw error(404, 'Shared recipe not found');
    }

    const recipeTagsResult = await db
      .select({
        name: tags.name,
      })
      .from(recipeTags)
      .innerJoin(tags, eq(recipeTags.tagId, tags.id))
      .where(eq(recipeTags.recipeId, recipe.id));

    const normalizedRecipe = normalizeRecipeData(recipe);

    return json({
      ...normalizedRecipe,
      tags: recipeTagsResult.map(rt => rt.name),
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get shared recipe error:', e);
    throw error(500, 'Internal server error');
  }
};