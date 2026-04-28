import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, tags, recipeTags } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
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

  return {
    recipe: {
      ...recipe,
      tags: recipeTagsResult.map(rt => rt.name),
    },
  };
};