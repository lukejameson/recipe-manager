import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { chatSessions, chatMessages } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, desc, like, or } from 'drizzle-orm';

// GET /api/chat-history/search - Search chat sessions
export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const query = url.searchParams.get('query');
    const searchIn = url.searchParams.get('searchIn') || 'all'; // 'all', 'title', 'content'

    if (!query) {
      throw error(400, 'Query parameter is required');
    }

    const searchTerm = `%${query}%`;

    let sessionIds = new Set<string>();

    // Search in session titles
    if (searchIn === 'all' || searchIn === 'title') {
      const titleMatches = await db
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.userId, user.userId),
            like(chatSessions.title, searchTerm)
          )
        );

      titleMatches.forEach(m => sessionIds.add(m.id));
    }

    // Search in message content
    if (searchIn === 'all' || searchIn === 'content') {
      const sessionsWithMessages = await db
        .select({ sessionId: chatMessages.sessionId })
        .from(chatMessages)
        .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
        .where(
          and(
            eq(chatSessions.userId, user.userId),
            like(chatMessages.content, searchTerm)
          )
        );

      sessionsWithMessages.forEach(m => sessionIds.add(m.sessionId));
    }

    if (sessionIds.size === 0) {
      return json([]);
    }

    // Get full session details
    const sessions = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, user.userId))
      .orderBy(desc(chatSessions.updatedAt));

    const filteredSessions = sessions.filter(s => sessionIds.has(s.id));

    return json(filteredSessions);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Search chat sessions error:', e);
    throw error(500, 'Internal server error');
  }
};
