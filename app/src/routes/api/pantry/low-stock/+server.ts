import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { pantryItems } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, lt, and, isNotNull } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const allItems = await db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, user.id));

    const lowStockItems = allItems.filter(
      (item) => item.quantity !== null && item.threshold !== null && item.quantity < item.threshold
    );

    return json(lowStockItems);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get low stock items error:', e);
    throw error(500, 'Internal server error');
  }
};
