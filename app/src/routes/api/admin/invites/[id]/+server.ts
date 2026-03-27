import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { inviteCodes, users } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

// DELETE /api/admin/invites/[id] - Delete an invite code
export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user || !user.isAdmin) {
      throw error(403, 'Forbidden');
    }

    const inviteId = params.id;
    if (!inviteId) {
      throw error(400, 'Invite ID is required');
    }

    // Check if invite exists
    const [invite] = await db
      .select({ id: inviteCodes.id })
      .from(inviteCodes)
      .where(eq(inviteCodes.id, inviteId))
      .limit(1);

    if (!invite) {
      throw error(404, 'Invite code not found');
    }

    await db.delete(inviteCodes).where(eq(inviteCodes.id, inviteId));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete invite error:', e);
    throw error(500, 'Internal server error');
  }
};