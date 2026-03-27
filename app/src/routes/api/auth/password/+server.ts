import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users } from '$lib/server/db/schema';
import { getCurrentUser, verifyPassword, hashPassword } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// PUT /api/auth/password - Change user password
export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = passwordChangeSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { currentPassword, newPassword } = result.data;

    // Get user with password hash
    const [userRecord] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (!userRecord) {
      throw error(404, 'User not found');
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, userRecord.passwordHash);
    if (!isValid) {
      throw error(400, 'Current password is incorrect');
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);
    await db.update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, user.userId));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Change password error:', e);
    throw error(500, 'Internal server error');
  }
};
