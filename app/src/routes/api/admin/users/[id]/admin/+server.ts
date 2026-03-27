import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users, auditLogs } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const toggleAdminSchema = z.object({
  isAdmin: z.boolean(),
});

// PUT /api/admin/users/[id]/admin - Toggle admin status
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
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

    // Prevent self-demotion
    if (targetUserId === user.userId) {
      throw error(400, 'Cannot change your own admin status');
    }

    const body = await request.json();
    const result = toggleAdminSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { isAdmin } = result.data;

    // Check if user exists
    const [targetUser] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw error(404, 'User not found');
    }

    await db
      .update(users)
      .set({ isAdmin })
      .where(eq(users.id, targetUserId));

    // Log the action
    await db.insert(auditLogs).values({
      userId: user.userId,
      action: isAdmin ? 'GRANT_ADMIN' : 'REVOKE_ADMIN',
      targetType: 'user',
      targetId: targetUserId,
      details: { username: targetUser.username, isAdmin },
      createdAt: new Date(),
    });

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Toggle admin error:', e);
    throw error(500, 'Internal server error');
  }
};