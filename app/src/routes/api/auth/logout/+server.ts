import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { sessions } from '$lib/server/db/schema';
import { clearAuthCookie, hashToken } from '$lib/server/auth';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');

    // Clear the auth cookie
    clearAuthCookie(cookies);

    if (token) {
      // Delete session from database
      const tokenHash = hashToken(token);
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    }

    return json({ success: true });
  } catch (e) {
    console.error('Logout error:', e);
    // Even if server call fails, clear the cookie
    clearAuthCookie(cookies);
    return json({ success: true });
  }
};
