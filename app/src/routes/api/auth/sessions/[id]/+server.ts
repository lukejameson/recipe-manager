import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { sessions } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

// DELETE /api/auth/sessions/[id] - Revoke a specific session
export const DELETE: RequestHandler = async ({ params, cookies }) => {
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

    // Verify the session belongs to the current user
    const [session] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session || session.userId !== user.userId) {
      throw error(404, 'Session not found');
    }

    await db.delete(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, user.userId)
        )
      );

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Revoke session error:', e);
    throw error(500, 'Internal server error');
  }
};
