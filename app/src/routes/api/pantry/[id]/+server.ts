import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { pantryItems, shoppingListItems } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const CATEGORIES = ['produce', 'dairy', 'meat', 'grains', 'canned', 'condiments', 'spices', 'frozen', 'snacks', 'other'];
const UNITS = ['cups', 'tbsp', 'tsp', 'oz', 'lbs', 'kg', 'g', 'ml', 'L', 'pieces', 'cans', 'bunches'];

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

    return json(item);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get pantry item error:', e);
    throw error(500, 'Internal server error');
  }
};

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({
      ingredient: z.string().optional(),
      displayName: z.string().optional(),
      quantity: z.number().nullable().optional(),
      unit: z.enum(UNITS as [string, ...string[]]).nullable().optional(),
      category: z.enum(CATEGORIES as [string, ...string[]]).nullable().optional(),
      expirationDate: z.string().nullable().optional(),
      threshold: z.number().nullable().optional(),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const [existingItem] = await db
      .select()
      .from(pantryItems)
      .where(and(eq(pantryItems.id, params.id), eq(pantryItems.userId, user.id)))
      .limit(1);

    if (!existingItem) {
      throw error(404, 'Item not found');
    }

    const updateData: Record<string, any> = { ...result.data };
    if (updateData.expirationDate) {
      updateData.expirationDate = new Date(updateData.expirationDate);
    }
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(pantryItems)
      .set(updateData)
      .where(eq(pantryItems.id, params.id))
      .returning();

    if (updated.quantity !== null && updated.threshold !== null && updated.quantity < updated.threshold) {
      const needed = updated.threshold - updated.quantity;
      const [shoppingItem] = await db
        .select()
        .from(shoppingListItems)
        .where(and(
          eq(shoppingListItems.pantryItemId, updated.id),
          eq(shoppingListItems.userId, user.id)
        ))
        .limit(1);

      if (!shoppingItem) {
        await db
          .insert(shoppingListItems)
          .values({
            userId: user.id,
            ingredient: updated.displayName,
            quantity: needed.toString(),
            category: updated.category || 'other',
            pantryItemId: updated.id,
            isChecked: false,
          });
      }
    }

    return json(updated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update pantry item error:', e);
    throw error(500, 'Internal server error');
  }
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
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

    await db.delete(pantryItems).where(eq(pantryItems.id, params.id));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete pantry item error:', e);
    throw error(500, 'Internal server error');
  }
};
