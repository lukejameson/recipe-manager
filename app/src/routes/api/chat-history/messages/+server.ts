import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { chatMessages, chatSessions } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const addMessageSchema = z.object({
  sessionId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  images: z.array(z.string()).optional(),
  referencedRecipes: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    ingredients: z.array(z.string()),
    instructions: z.array(z.string()),
  })).optional(),
  generatedRecipe: z.object({
    title: z.string(),
    description: z.string().optional(),
    ingredients: z.array(z.string()),
    instructions: z.array(z.string()),
    prepTime: z.number().optional(),
    cookTime: z.number().optional(),
    servings: z.number().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

// POST /api/chat-history/messages - Add a message to a session
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = addMessageSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { sessionId, role, content, images, referencedRecipes, generatedRecipe } = result.data;

    // Verify session belongs to user
    const [session] = await db
      .select({ id: chatSessions.id, messageCount: chatSessions.messageCount })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.userId, user.userId)
        )
      )
      .limit(1);

    if (!session) {
      throw error(404, 'Chat session not found');
    }

    // Create message
    const [message] = await db.insert(chatMessages).values({
      sessionId,
      role,
      content,
      images: images || null,
      referencedRecipes: referencedRecipes || null,
      generatedRecipe: generatedRecipe || null,
      createdAt: new Date(),
    }).returning();

    // Update session with last message preview and count
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    await db
      .update(chatSessions)
      .set({
        lastMessagePreview: preview,
        messageCount: (session.messageCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    return json(message);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Add chat message error:', e);
    throw error(500, 'Internal server error');
  }
};
