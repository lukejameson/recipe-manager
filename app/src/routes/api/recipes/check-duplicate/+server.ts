import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, tags, recipeTags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, or } from 'drizzle-orm';
import { normalizeRecipeData } from '$lib/utils/recipe-helpers';

// GET /api/recipes/check-duplicate - Check if a recipe already exists
export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const title = url.searchParams.get('title');
    const sourceUrl = url.searchParams.get('sourceUrl');

    if (!title && !sourceUrl) {
      throw error(400, 'Title or sourceUrl required');
    }

    // Build query conditions - check for exact title match OR sourceUrl match
    const conditions: any[] = [eq(recipes.userId, user.userId)];

    if (title && sourceUrl) {
      // Check if either title matches OR sourceUrl matches (use OR logic)
      conditions.push(
        or(
          eq(recipes.title, title),
          eq(recipes.sourceUrl, sourceUrl)
        )
      );
    } else if (title) {
      conditions.push(eq(recipes.title, title));
    } else if (sourceUrl) {
      conditions.push(eq(recipes.sourceUrl, sourceUrl));
    }

    const [existingRecipe] = await db
      .select()
      .from(recipes)
      .where(and(...conditions))
      .limit(1);

    if (existingRecipe) {
      // Get tags for the existing recipe
      const recipeTagsList = await db
        .select({ name: tags.name, id: tags.id })
        .from(recipeTags)
        .innerJoin(tags, eq(recipeTags.tagId, tags.id))
        .where(eq(recipeTags.recipeId, existingRecipe.id));

      return json({
        exists: true,
        recipe: {
          ...normalizeRecipeData(existingRecipe),
          tags: recipeTagsList,
        },
      });
    }

    return json({ exists: false });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Check duplicate error:', e);
    throw error(500, 'Internal server error');
  }
};
