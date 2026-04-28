import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { agents } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const { id } = params;
    const existing = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (existing.length === 0) {
      throw error(404, 'Agent not found');
    }
    const agent = existing[0];
    if (agent.isBuiltIn && !user.isAdmin) {
      throw error(403, 'Cannot edit built-in agents');
    }
    if (!agent.isBuiltIn && agent.userId !== user.id && !user.isAdmin) {
      throw error(403, 'Cannot edit another user\'s agent');
    }
    const body = await request.json();
    const { name, description, systemPrompt, icon, modelId } = body;
    if (!name?.trim() || !systemPrompt?.trim()) {
      throw error(400, 'Name and system prompt are required');
    }
    const [updated] = await db.update(agents)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        systemPrompt: systemPrompt.trim(),
        icon: icon || '🤖',
        modelId: modelId || null,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id))
      .returning();
    return json(updated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update agent error:', e);
    throw error(500, 'Internal server error');
  }
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const { id } = params;
    const existing = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (existing.length === 0) {
      throw error(404, 'Agent not found');
    }
    const agent = existing[0];
    if (agent.isBuiltIn) {
      throw error(403, 'Cannot delete built-in agents');
    }
    if (agent.userId !== user.id && !user.isAdmin) {
      throw error(403, 'Cannot delete another user\'s agent');
    }
    await db.delete(agents).where(eq(agents.id, id));
    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete agent error:', e);
    throw error(500, 'Internal server error');
  }
};
