import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import {
  users,
  sessions,
  recipes,
  tags,
  recipeTags,
  collections,
  collectionRecipes,
  shoppingListItems,
  memories,
  chatSessions,
  agents,
  auditLogs
} from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';

// DELETE /api/admin/users/[id] - Delete a user
export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user || !user.isAdmin) {
      throw error(403, 'Forbidden');
    }

    const targetUserId = params.id;
    if (!targetUserId) {
      throw error(400, 'User ID is required');
    }

    // Prevent self-deletion
    if (targetUserId === user.userId) {
      throw error(400, 'Cannot delete your own account through admin');
    }

    // Check if user exists
    const [targetUser] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw error(404, 'User not found');
    }

    // Delete user data (cascade handles most)
    await db.delete(sessions).where(eq(sessions.userId, targetUserId));
    await db.delete(shoppingListItems).where(eq(shoppingListItems.userId, targetUserId));
    await db.delete(memories).where(eq(memories.userId, targetUserId));
    await db.delete(chatSessions).where(eq(chatSessions.userId, targetUserId));
    await db.delete(agents).where(eq(agents.userId, targetUserId));

    // Get user's recipes
    const userRecipes = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.userId, targetUserId));

    const recipeIds = userRecipes.map(r => r.id);

    // Delete recipe associations
    for (const recipeId of recipeIds) {
      await db.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId));
    }

    await db.delete(recipes).where(eq(recipes.userId, targetUserId));
    await db.delete(collections).where(eq(collections.userId, targetUserId));
    await db.delete(tags).where(eq(tags.userId, targetUserId));

    // Finally delete user
    await db.delete(users).where(eq(users.id, targetUserId));

    // Log the action
    await db.insert(auditLogs).values({
      userId: user.userId,
      action: 'DELETE_USER',
      targetType: 'user',
      targetId: targetUserId,
      details: { username: targetUser.username },
      createdAt: new Date(),
    });

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete user error:', e);
    throw error(500, 'Internal server error');
  }
};