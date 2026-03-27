import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { auditLogs, users } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, desc, sql, and } from 'drizzle-orm';

// GET /api/admin/audit-logs - Get audit logs
export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user || !user.isAdmin) {
      throw error(403, 'Forbidden');
    }

    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const action = url.searchParams.get('action');

    // Build base query
    const baseQuery = db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        user: {
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id));

    // Apply action filter if provided
    let logs;
    if (action) {
      logs = await baseQuery
        .where(eq(auditLogs.action, action))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      logs = await baseQuery
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs);

    return json({
      logs,
      total: countResult.count,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get audit logs error:', e);
    throw error(500, 'Internal server error');
  }
};