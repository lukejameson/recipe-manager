import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { memories } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// PUT /api/settings/memories/[id] - Update a memory
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({
      enabled: z.boolean().optional(),
      content: z.string().min(1).max(500).optional(),
    });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, params.id), eq(memories.userId, user.id)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Memory not found');
    }

    const updateData: Record<string, any> = {};
    if (result.data.enabled !== undefined) {
      updateData.enabled = result.data.enabled;
    }
    if (result.data.content !== undefined) {
      updateData.content = result.data.content;
    }

    if (Object.keys(updateData).length === 0) {
      return json(existing);
    }

    const [updated] = await db
      .update(memories)
      .set(updateData)
      .where(eq(memories.id, params.id))
      .returning();

    return json(updated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update memory error:', e);
    throw error(500, 'Internal server error');
  }
};

// DELETE /api/settings/memories/[id] - Delete a memory
export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, params.id), eq(memories.userId, user.id)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Memory not found');
    }

    await db.delete(memories).where(eq(memories.id, params.id));
    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete memory error:', e);
    throw error(500, 'Internal server error');
  }
};
