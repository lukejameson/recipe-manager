import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { agents } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, or, isNull } from 'drizzle-orm';
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

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const body = await request.json();
    const { name, description, systemPrompt, icon, modelId } = body;
    if (!name?.trim() || !systemPrompt?.trim()) {
      throw error(400, 'Name and system prompt are required');
    }
    const [newAgent] = await db.insert(agents).values({
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description?.trim() || null,
      systemPrompt: systemPrompt.trim(),
      icon: icon || '🤖',
      modelId: modelId || null,
      isBuiltIn: false,
      userId: user.id,
    }).returning();
    return json(newAgent);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Create agent error:', e);
    throw error(500, 'Internal server error');
  }
};
