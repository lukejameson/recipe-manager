import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { chatSessions, chatMessages } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, params.id), eq(chatSessions.userId, user.id)))
      .limit(1);
    if (!session) {
      throw error(404, 'Chat session not found');
    }
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, params.id))
      .orderBy(chatMessages.createdAt);
    return json({
      session,
      messages,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get chat session error:', e);
    throw error(500, 'Internal server error');
  }
};

const updateChatSessionSchema = z.object({
  title: z.string().min(1).max(200),
});

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const sessionId = params.id;
    if (!sessionId) {
      throw error(400, 'Session ID is required');
    }

    const body = await request.json();
    const result = updateChatSessionSchema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const [session] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.userId, user.id)
        )
      )
      .limit(1);

    if (!session) {
      throw error(404, 'Chat session not found');
    }

    const [updated] = await db
      .update(chatSessions)
      .set({ 
        title: result.data.title,
        updatedAt: new Date()
      })
      .where(eq(chatSessions.id, sessionId))
      .returning();

    return json(updated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update chat session error:', e);
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

    const sessionId = params.id;
    if (!sessionId) {
      throw error(400, 'Session ID is required');
    }

    const [session] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.userId, user.id)
        )
      )
      .limit(1);

    if (!session) {
      throw error(404, 'Chat session not found');
    }

    await db
      .delete(chatSessions)
      .where(eq(chatSessions.id, sessionId));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete chat session error:', e);
    throw error(500, 'Internal server error');
  }
};
