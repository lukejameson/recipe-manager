import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users, auditLogs } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { UserFeatureFlags } from '$lib/server/db/schema';

const updateFeaturesSchema = z.object({
  featureFlags: z.record(z.boolean()),
});

// PUT /api/admin/users/[id]/features - Update user feature flags
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

    const body = await request.json();
    const result = updateFeaturesSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { featureFlags } = result.data;

    // Check if user exists
    const [targetUser] = await db
      .select({ id: users.id, featureFlags: users.featureFlags })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw error(404, 'User not found');
    }

    // Merge with existing flags
    const existingFlags = (targetUser.featureFlags || {}) as UserFeatureFlags;
    const mergedFlags = { ...existingFlags, ...featureFlags };

    await db
      .update(users)
      .set({ featureFlags: mergedFlags })
      .where(eq(users.id, targetUserId));

    // Log the action
    await db.insert(auditLogs).values({
      userId: user.userId,
      action: 'UPDATE_USER_FEATURES',
      targetType: 'user',
      targetId: targetUserId,
      details: { featureFlags },
      createdAt: new Date(),
    });

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update user features error:', e);
    throw error(500, 'Internal server error');
  }
};