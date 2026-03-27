import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { chatSessions } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

// POST /api/chat-history/[id]/favorite - Toggle favorite status
export const POST: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const sessionId = params.id;
    if (!sessionId) {
      throw error(400, 'Session ID is required');
    }

    // Get current session
    const [session] = await db
      .select({
        id: chatSessions.id,
        isFavorite: chatSessions.isFavorite,
      })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.userId, user.userId)
        )
      )
      .limit(1);

    if (!session) {
      throw error(404, 'Chat session not found');
    }

    // Toggle favorite status
    const [updated] = await db
      .update(chatSessions)
      .set({ isFavorite: !session.isFavorite })
      .where(eq(chatSessions.id, sessionId))
      .returning();

    return json(updated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Toggle favorite error:', e);
    throw error(500, 'Internal server error');
  }
};
