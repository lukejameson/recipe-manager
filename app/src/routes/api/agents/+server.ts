import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { agents } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, or, isNull } from 'drizzle-orm';

// GET /api/agents - List all agents (built-in and user-created)
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const allAgents = await db
      .select()
      .from(agents)
      .where(
        or(
          eq(agents.isBuiltIn, true),
          eq(agents.userId, user.id)
        )
      );

    return json(allAgents);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List agents error:', e);
    throw error(500, 'Internal server error');
  }
};
