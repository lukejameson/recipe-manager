import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { memories } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/settings/memories - List all memories
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const userMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, user.id))
      .orderBy(desc(memories.createdAt));

    return json(userMemories);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List memories error:', e);
    throw error(500, 'Internal server error');
  }
};

// POST /api/settings/memories - Create a new memory
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({ content: z.string().min(1).max(500) });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const [memory] = await db
      .insert(memories)
      .values({
        userId: user.id,
        content: result.data.content,
        enabled: true,
      })
      .returning();

    return json(memory);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Create memory error:', e);
    throw error(500, 'Internal server error');
  }
};
