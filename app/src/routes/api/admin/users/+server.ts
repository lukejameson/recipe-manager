import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users, inviteCodes, auditLogs } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, isNull, desc } from 'drizzle-orm';
import crypto from 'crypto';

// GET /api/admin/users - List all users (admin only)
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Check if admin
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!userRecord?.isAdmin) {
      throw error(403, 'Admin access required');
    }

    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        isAdmin: users.isAdmin,
        featureFlags: users.featureFlags,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return json(allUsers);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List users error:', e);
    throw error(500, 'Internal server error');
  }
};
