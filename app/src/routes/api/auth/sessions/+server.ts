import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { sessions } from '$lib/server/db/schema';
import { getCurrentUser, hashToken } from '$lib/server/auth';
import { eq, and, gt, ne } from 'drizzle-orm';

// GET /api/auth/sessions - List all sessions for current user
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const userSessions = await db
      .select({
        id: sessions.id,
        tokenHash: sessions.tokenHash,
        userAgent: sessions.userAgent,
        ipAddress: sessions.ipAddress,
        createdAt: sessions.createdAt,
        lastActiveAt: sessions.lastActiveAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, user.userId),
          gt(sessions.expiresAt, new Date())
        )
      );

    const currentTokenHash = token ? hashToken(token) : null;
    return json(userSessions.map(({ tokenHash, ...session }) => ({
      ...session,
      isCurrent: currentTokenHash === tokenHash,
    })));
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List sessions error:', e);
    throw error(500, 'Internal server error');
  }
};

// DELETE /api/auth/sessions - Revoke all other sessions
export const DELETE: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Revoke all sessions except current one
    await db.delete(sessions)
      .where(
        and(
          eq(sessions.userId, user.userId),
          ne(sessions.id, user.sessionId)
        )
      );

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Revoke all sessions error:', e);
    throw error(500, 'Internal server error');
  }
};
