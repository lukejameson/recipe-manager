import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { db } from '$lib/server/db/db';
import { recipes } from '$lib/server/db/schema';
import { z } from 'zod';
import { eq, like } from 'drizzle-orm';

const searchRecipesSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = searchRecipesSchema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { query, limit } = result.data;

    const dbResults = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        description: recipes.description,
        ingredients: recipes.ingredients,
        instructions: recipes.instructions,
        prepTime: recipes.prepTime,
        cookTime: recipes.cookTime,
        servings: recipes.servings,
      })
      .from(recipes)
      .where(eq(recipes.userId, user.userId))
      .limit(50);

    const searchLower = query.toLowerCase();
    const matches = dbResults
      .filter((recipe) => recipe.title.toLowerCase().includes(searchLower))
      .slice(0, limit)
      .map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients?.items?.map((item: any) => item.text) ?? [],
        instructions: recipe.instructions?.items?.map((item: any) => item.text) ?? [],
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
      }));

    return json(matches);
  } catch (e) {
    if ('status' in e) throw e;
    console.error('Search recipes mention error:', e);
    return json([]);
  }
};