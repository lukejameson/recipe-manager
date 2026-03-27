import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { chatSessions, chatMessages } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, desc } from 'drizzle-orm';

// GET /api/chat-history/[id] - Get chat session with messages
export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Get session
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, params.id), eq(chatSessions.userId, user.id)))
      .limit(1);

    if (!session) {
      throw error(404, 'Chat session not found');
    }

    // Get messages
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, params.id))
      .orderBy(chatMessages.createdAt);

    return json({
      session,
      messages,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get chat session error:', e);
    throw error(500, 'Internal server error');
  }
};
