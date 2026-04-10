import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users, sessions, recipes, tags, recipeTags, recipePhotos, photos, collections, collectionRecipes, shoppingListItems, memories, chatSessions, chatMessages, agents } from '$lib/server/db/schema';
import { getCurrentUser, verifyPassword, clearAuthCookie } from '$lib/server/auth';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

// DELETE /api/auth/account - Delete user account
export const DELETE: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = deleteAccountSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { password } = result.data;

    // Get user with password hash
    const [userRecord] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (!userRecord) {
      throw error(404, 'User not found');
    }

    // Verify password
    const isValid = await verifyPassword(password, userRecord.passwordHash);
    if (!isValid) {
      throw error(400, 'Password is incorrect');
    }

    // Delete all user data (cascade will handle most)
    // Delete sessions
    await db.delete(sessions).where(eq(sessions.userId, user.userId));

    // Delete shopping list items
    await db.delete(shoppingListItems).where(eq(shoppingListItems.userId, user.userId));

    // Delete memories
    await db.delete(memories).where(eq(memories.userId, user.userId));

    // Delete chat sessions (cascade will delete messages)
    await db.delete(chatSessions).where(eq(chatSessions.userId, user.userId));

    // Delete user-created agents
    await db.delete(agents).where(eq(agents.userId, user.userId));

    // Get all user's recipes
    const userRecipes = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.userId, user.userId));

    const recipeIds = userRecipes.map(r => r.id);
    if (recipeIds.length > 0) {
      await db.delete(recipeTags).where(inArray(recipeTags.recipeId, recipeIds));
      await db.delete(recipePhotos).where(inArray(recipePhotos.recipeId, recipeIds));
    }
    await db.delete(photos).where(eq(photos.accountId, user.userId));
    await db.delete(recipes).where(eq(recipes.userId, user.userId));

    // Delete collections
    await db.delete(collections).where(eq(collections.userId, user.userId));

    // Delete tags
    await db.delete(tags).where(eq(tags.userId, user.userId));

    // Finally delete the user
    await db.delete(users).where(eq(users.id, user.userId));

    // Clear auth cookie
    clearAuthCookie(cookies);

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete account error:', e);
    throw error(500, 'Internal server error');
  }
};
