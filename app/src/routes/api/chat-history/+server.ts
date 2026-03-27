import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { chatSessions, chatMessages, agents } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createChatSessionSchema = z.object({
  title: z.string().min(1).max(200),
  agentId: z.string().optional(),
});

// GET /api/chat-history - List all chat sessions
export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const onlyFavorites = url.searchParams.get('onlyFavorites') === 'true';

    let query = db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, user.id))
      .orderBy(desc(chatSessions.updatedAt));

    const sessions = await query;

    // Filter by favorites if requested
    const filteredSessions = onlyFavorites
      ? sessions.filter(s => s.isFavorite)
      : sessions;

    return json(filteredSessions);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List chat sessions error:', e);
    throw error(500, 'Internal server error');
  }
};

// POST /api/chat-history - Create a new chat session
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = createChatSessionSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { title, agentId } = result.data;

    // Validate agentId if provided
    if (agentId) {
      const [agent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      if (!agent) {
        throw error(400, 'Invalid agent ID');
      }
    }

    const [newSession] = await db.insert(chatSessions).values({
      userId: user.id,
      title,
      agentId: agentId || null,
      isFavorite: false,
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return json(newSession);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Create chat session error:', e);
    throw error(500, 'Internal server error');
  }
};
