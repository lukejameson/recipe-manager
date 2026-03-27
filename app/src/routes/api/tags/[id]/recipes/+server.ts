import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { tags, recipeTags, recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, sql, and } from 'drizzle-orm';

// GET /api/tags/[id]/recipes - Get recipes for a tag (as a collection)
export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Get tag info
    const [tag] = await db
      .select({
        id: tags.id,
        name: tags.name,
      })
      .from(tags)
      .where(and(eq(tags.id, params.id), eq(tags.userId, user.userId)))
      .limit(1);

    if (!tag) {
      throw error(404, 'Tag not found');
    }

    // Get recipes for this tag
    const tagRecipes = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        description: recipes.description,
        imageUrl: recipes.imageUrl,
        prepTime: recipes.prepTime,
        cookTime: recipes.cookTime,
        servings: recipes.servings,
        difficulty: recipes.difficulty,
        rating: recipes.rating,
        isFavorite: recipes.isFavorite,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
      })
      .from(recipes)
      .innerJoin(recipeTags, eq(recipes.id, recipeTags.recipeId))
      .where(and(eq(recipeTags.tagId, params.id), eq(recipes.userId, user.userId)))
      .orderBy(recipes.title);

    return json({
      id: tag.id,
      name: tag.name,
      description: `Recipes tagged with ${tag.name}`,
      recipes: tagRecipes,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get tag recipes error:', e);
    throw error(500, 'Internal server error');
  }
};
