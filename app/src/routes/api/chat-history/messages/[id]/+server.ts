import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { chatMessages, chatSessions } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

// DELETE /api/chat-history/messages/[id] - Delete a specific message
export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const messageId = params.id;
    if (!messageId) {
      throw error(400, 'Message ID is required');
    }

    // Get the message and verify it belongs to the user's session
    const [message] = await db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatMessages.id, messageId),
          eq(chatSessions.userId, user.userId)
        )
      )
      .limit(1);

    if (!message) {
      throw error(404, 'Message not found');
    }

    await db.delete(chatMessages)
      .where(eq(chatMessages.id, messageId));

    // Update session message count
    const [session] = await db
      .select({ messageCount: chatSessions.messageCount })
      .from(chatSessions)
      .where(eq(chatSessions.id, message.sessionId))
      .limit(1);

    if (session) {
      await db
        .update(chatSessions)
        .set({
          messageCount: Math.max(0, (session.messageCount || 1) - 1),
          updatedAt: new Date(),
        })
        .where(eq(chatSessions.id, message.sessionId));
    }

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete chat message error:', e);
    throw error(500, 'Internal server error');
  }
};
