import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { pantryItems } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const CATEGORIES = ['produce', 'dairy', 'meat', 'grains', 'canned', 'condiments', 'spices', 'frozen', 'snacks', 'other'];
const UNITS = ['cups', 'tbsp', 'tsp', 'oz', 'lbs', 'kg', 'g', 'ml', 'L', 'pieces', 'cans', 'bunches'];

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const items = await db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, user.id));

    return json(items);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get pantry items error:', e);
    throw error(500, 'Internal server error');
  }
};

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
      displayName: z.string().optional(),
      quantity: z.number().optional(),
      unit: z.enum(UNITS as [string, ...string[]]).optional(),
      category: z.enum(CATEGORIES as [string, ...string[]]).optional(),
      expirationDate: z.string().optional(),
      threshold: z.number().optional(),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const data = result.data;
    const displayName = data.displayName || data.ingredient;

    const [newItem] = await db
      .insert(pantryItems)
      .values({
        ...data,
        userId: user.id,
        displayName,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
        threshold: data.threshold ?? 1,
      })
      .returning();

    return json(newItem);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Add pantry item error:', e);
    throw error(500, 'Internal server error');
  }
};

export const DELETE: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    await db
      .delete(pantryItems)
      .where(eq(pantryItems.userId, user.id));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Clear pantry error:', e);
    throw error(500, 'Internal server error');
  }
};
