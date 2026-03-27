import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { shoppingListItems } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// PUT /api/shopping-list/[id] - Toggle checked status or update item
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({
      isChecked: z.boolean().optional(),
      ingredient: z.string().optional(),
      quantity: z.string().optional(),
      category: z.string().optional(),
    });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    // Verify ownership
    const [item] = await db
      .select()
      .from(shoppingListItems)
      .where(and(eq(shoppingListItems.id, params.id), eq(shoppingListItems.userId, user.id)))
      .limit(1);

    if (!item) {
      throw error(404, 'Item not found');
    }

    const updateData: Record<string, any> = {};
    if (result.data.isChecked !== undefined) {
      updateData.isChecked = result.data.isChecked;
    }
    if (result.data.ingredient !== undefined) {
      updateData.ingredient = result.data.ingredient;
    }
    if (result.data.quantity !== undefined) {
      updateData.quantity = result.data.quantity;
    }
    if (result.data.category !== undefined) {
      updateData.category = result.data.category;
    }

    const [updated] = await db
      .update(shoppingListItems)
      .set(updateData)
      .where(eq(shoppingListItems.id, params.id))
      .returning();

    return json(updated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update shopping list item error:', e);
    throw error(500, 'Internal server error');
  }
};

// DELETE /api/shopping-list/[id] - Delete a shopping list item
export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Verify ownership
    const [item] = await db
      .select()
      .from(shoppingListItems)
      .where(and(eq(shoppingListItems.id, params.id), eq(shoppingListItems.userId, user.id)))
      .limit(1);

    if (!item) {
      throw error(404, 'Item not found');
    }

    await db.delete(shoppingListItems).where(eq(shoppingListItems.id, params.id));
    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete shopping list item error:', e);
    throw error(500, 'Internal server error');
  }
};
