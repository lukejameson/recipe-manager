import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { shoppingListItems } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

// POST /api/shopping-list/[id]/toggle - Toggle checked status
export const POST: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const itemId = params.id;
    if (!itemId) {
      throw error(400, 'Item ID is required');
    }

    // Get current item
    const [item] = await db
      .select({
        id: shoppingListItems.id,
        isChecked: shoppingListItems.isChecked,
      })
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.id, itemId),
          eq(shoppingListItems.userId, user.userId)
        )
      )
      .limit(1);

    if (!item) {
      throw error(404, 'Shopping list item not found');
    }

    // Toggle checked status
    const [updated] = await db
      .update(shoppingListItems)
      .set({ isChecked: !item.isChecked })
      .where(eq(shoppingListItems.id, itemId))
      .returning();

    return json(updated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Toggle shopping list item error:', e);
    throw error(500, 'Internal server error');
  }
};