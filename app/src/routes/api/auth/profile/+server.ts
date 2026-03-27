import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  email: z.string().email().optional().nullable(),
  displayName: z.string().min(1).max(100).optional().nullable(),
});

// PUT /api/auth/profile - Update user profile
export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = profileUpdateSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const updateData: { email?: string | null; displayName?: string | null } = {};
    if (result.data.email !== undefined) updateData.email = result.data.email;
    if (result.data.displayName !== undefined) updateData.displayName = result.data.displayName;

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, user.userId));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update profile error:', e);
    throw error(500, 'Internal server error');
  }
};
