import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users, DEFAULT_FEATURE_FLAGS } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Get fresh user data
    const freshUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!freshUser) {
      throw error(401, 'User not found');
    }

    const featureFlags = freshUser.featureFlags ?? DEFAULT_FEATURE_FLAGS;

    return json({
      id: freshUser.id,
      username: freshUser.username,
      isAdmin: freshUser.isAdmin,
      email: freshUser.email,
      displayName: freshUser.displayName,
      featureFlags,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get user error:', e);
    throw error(500, 'Internal server error');
  }
};
