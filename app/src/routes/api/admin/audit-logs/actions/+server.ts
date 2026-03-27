import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { auditLogs } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { sql } from 'drizzle-orm';

// GET /api/admin/audit-logs/actions - Get list of all audit log actions
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user || !user.isAdmin) {
      throw error(403, 'Forbidden');
    }

    // Get distinct actions
    const actions = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .groupBy(auditLogs.action)
      .orderBy(auditLogs.action);

    return json(actions.map(a => a.action));
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get audit log actions error:', e);
    throw error(500, 'Internal server error');
  }
};