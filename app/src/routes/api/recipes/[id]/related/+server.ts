import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, recipeTags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, inArray, sql, ne } from 'drizzle-orm';

/**
 * GET /api/recipes/[id]/related - Get related recipes based on shared tags
 */
export const GET: RequestHandler = async ({ params, url, cookies }) => {
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

    const limit = parseInt(url.searchParams.get('limit') || '6', 10);

    // Get recipe's tags
    const recipeTagIds = await db
      .select({ tagId: recipeTags.tagId })
      .from(recipeTags)
      .where(eq(recipeTags.recipeId, params.id));

    if (recipeTagIds.length === 0) {
      // No tags, return random recipes from same user
      const related = await db
        .select({
          id: recipes.id,
          title: recipes.title,
          description: recipes.description,
          imageUrl: recipes.imageUrl,
          prepTime: recipes.prepTime,
          cookTime: recipes.cookTime,
          servings: recipes.servings,
          isFavorite: recipes.isFavorite,
          rating: recipes.rating,
        })
        .from(recipes)
        .where(and(
          eq(recipes.userId, user.userId),
          ne(recipes.id, params.id)
        ))
        .orderBy(sql`RANDOM()`)
        .limit(limit);

      return json(related);
    }

    // Find recipes with shared tags
    const tagIds = recipeTagIds.map(rt => rt.tagId);

    const relatedRecipeIds = await db
      .select({
        recipeId: recipeTags.recipeId,
        sharedTags: sql<number>`COUNT(${recipeTags.tagId})`.as('sharedTags'),
      })
      .from(recipeTags)
      .where(and(
        inArray(recipeTags.tagId, tagIds),
        ne(recipeTags.recipeId, params.id)
      ))
      .groupBy(recipeTags.recipeId)
      .orderBy(sql`COUNT(${recipeTags.tagId}) DESC`)
      .limit(limit);

    if (relatedRecipeIds.length === 0) {
      return json([]);
    }

    // Get full recipe details
    const related = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        description: recipes.description,
        imageUrl: recipes.imageUrl,
        prepTime: recipes.prepTime,
        cookTime: recipes.cookTime,
        servings: recipes.servings,
        isFavorite: recipes.isFavorite,
        rating: recipes.rating,
      })
      .from(recipes)
      .where(and(
        inArray(recipes.id, relatedRecipeIds.map(r => r.recipeId)),
        eq(recipes.userId, user.userId)
      ));

    // Sort by shared tags count
    const sortedRelated = related.sort((a, b) => {
      const aScore = relatedRecipeIds.find(r => r.recipeId === a.id)?.sharedTags || 0;
      const bScore = relatedRecipeIds.find(r => r.recipeId === b.id)?.sharedTags || 0;
      return bScore - aScore;
    });

    return json(sortedRelated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get related recipes error:', e);
    throw error(500, 'Internal server error');
  }
};
