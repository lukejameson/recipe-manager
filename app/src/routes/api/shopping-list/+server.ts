import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { shoppingListItems, recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/shopping-list - Get all shopping list items
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const items = await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.userId, user.id));

    return json(items);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get shopping list error:', e);
    throw error(500, 'Internal server error');
  }
};

// POST /api/shopping-list - Add item to shopping list
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({
      ingredient: z.string(),
      quantity: z.string().optional(),
      category: z.string().optional(),
      recipeId: z.string().optional(),
    });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const data = result.data;

    // If recipeId is provided, verify it belongs to user
    if (data.recipeId) {
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, data.recipeId), eq(recipes.userId, user.id)))
        .limit(1);

      if (!recipe) {
        throw error(404, 'Recipe not found');
      }
    }

    const [newItem] = await db
      .insert(shoppingListItems)
      .values({
        ...data,
        userId: user.id,
        isChecked: false,
      })
      .returning();

    return json(newItem);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Add shopping list item error:', e);
    throw error(500, 'Internal server error');
  }
};

// DELETE /api/shopping-list - Clear all items or just checked items
export const DELETE: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const checkedOnly = url.searchParams.get('checked') === 'true';

    if (checkedOnly) {
      await db
        .delete(shoppingListItems)
        .where(and(
          eq(shoppingListItems.isChecked, true),
          eq(shoppingListItems.userId, user.id)
        ));
    } else {
      await db
        .delete(shoppingListItems)
        .where(eq(shoppingListItems.userId, user.id));
    }

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Clear shopping list error:', e);
    throw error(500, 'Internal server error');
  }
};
