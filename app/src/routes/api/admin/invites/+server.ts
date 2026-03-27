import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users, inviteCodes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, desc, inArray } from 'drizzle-orm';
import crypto from 'crypto';

// GET /api/admin/invites - List all invite codes (admin only)
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

    const codes = await db
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        createdBy: inviteCodes.createdBy,
        usedBy: inviteCodes.usedBy,
        usedAt: inviteCodes.usedAt,
        expiresAt: inviteCodes.expiresAt,
        createdAt: inviteCodes.createdAt,
        createdByUsername: users.username,
      })
      .from(inviteCodes)
      .leftJoin(users, eq(inviteCodes.createdBy, users.id))
      .orderBy(desc(inviteCodes.createdAt));

    // Get used by usernames
    const usedByIds = codes.map(c => c.usedBy).filter((id): id is string => id !== null);
    const usedByUsers = usedByIds.length > 0
      ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, usedByIds))
      : [];
    const usedByMap = new Map(usedByUsers.map(u => [u.id, u.username]));

    // Add computed properties
    const now = new Date();
    const codesWithComputed = codes.map(code => ({
      ...code,
      usedByUsername: code.usedBy ? usedByMap.get(code.usedBy) || null : null,
      isUsed: code.usedBy !== null,
      isExpired: code.expiresAt ? new Date(code.expiresAt) < now : false,
    }));

    return json(codesWithComputed);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List invite codes error:', e);
    throw error(500, 'Internal server error');
  }
};

// POST /api/admin/invites - Create a new invite code (admin only)
export const POST: RequestHandler = async ({ cookies }) => {
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

    // Generate invite code
    const code = crypto.randomBytes(9).toString('base64url').substring(0, 12).toUpperCase();

    const [newCode] = await db
      .insert(inviteCodes)
      .values({
        code,
        createdBy: user.id,
      })
      .returning();

    return json(newCode);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Create invite code error:', e);
    throw error(500, 'Internal server error');
  }
};
