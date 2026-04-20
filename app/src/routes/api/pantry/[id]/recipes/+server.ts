import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { pantryItems, pantryItemRecipes, recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const [item] = await db
      .select()
      .from(pantryItems)
      .where(and(eq(pantryItems.id, params.id), eq(pantryItems.userId, user.id)))
      .limit(1);

    if (!item) {
      throw error(404, 'Item not found');
    }

    const linkedRecipes = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        description: recipes.description,
        imageUrl: recipes.imageUrl,
      })
      .from(pantryItemRecipes)
      .innerJoin(recipes, eq(pantryItemRecipes.recipeId, recipes.id))
      .where(eq(pantryItemRecipes.pantryItemId, params.id));

    return json(linkedRecipes);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get pantry item recipes error:', e);
    throw error(500, 'Internal server error');
  }
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({
      recipeId: z.string(),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { recipeId } = result.data;

    const [item] = await db
      .select()
      .from(pantryItems)
      .where(and(eq(pantryItems.id, params.id), eq(pantryItems.userId, user.id)))
      .limit(1);

    if (!item) {
      throw error(404, 'Pantry item not found');
    }

    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), eq(recipes.userId, user.id)))
      .limit(1);

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    await db
      .insert(pantryItemRecipes)
      .values({
        pantryItemId: params.id,
        recipeId,
      })
      .onConflictDoNothing();

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Link recipe to pantry item error:', e);
    throw error(500, 'Internal server error');
  }
};
