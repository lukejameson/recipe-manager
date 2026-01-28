import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { chatSessions, chatMessages, type ReferencedRecipe, type GeneratedRecipe } from '../../db/schema.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

const t = initTRPC.context<Context>().create();

// Auth middleware
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }
  return next({ ctx: { userId: ctx.userId } });
});

const protectedProcedure = t.procedure.use(isAuthenticated);

// Input validation schemas
const referencedRecipeSchema: z.ZodType<ReferencedRecipe> = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  ingredients: z.array(z.string()),
  instructions: z.array(z.string()),
});

const generatedRecipeSchema: z.ZodType<GeneratedRecipe> = z.object({
  title: z.string(),
  description: z.string().optional(),
  ingredients: z.array(z.string()),
  instructions: z.array(z.string()),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  servings: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

const createSessionSchema = z.object({
  title: z.string().min(1).max(200),
  agentId: z.string().optional(),
});

const addMessageSchema = z.object({
  sessionId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  images: z.array(z.string()).optional(),
  referencedRecipes: z.array(referencedRecipeSchema).optional(),
  generatedRecipe: generatedRecipeSchema.optional(),
});

export const chatHistoryRouter = t.router({
  /**
   * List all chat sessions for the current user with optional filters
   */
  list: protectedProcedure
    .input(
      z.object({
        agentId: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        onlyFavorites: z.boolean().optional(),
        sortBy: z.enum(['updatedAt', 'createdAt', 'messageCount']).optional().default('updatedAt'),
        sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Build where conditions
      const conditions = [eq(chatSessions.userId, ctx.userId)];

      if (input?.agentId) {
        conditions.push(eq(chatSessions.agentId, input.agentId));
      }

      if (input?.dateFrom) {
        conditions.push(sql`${chatSessions.createdAt} >= ${input.dateFrom}`);
      }

      if (input?.dateTo) {
        conditions.push(sql`${chatSessions.createdAt} <= ${input.dateTo}`);
      }

      if (input?.onlyFavorites) {
        conditions.push(eq(chatSessions.isFavorite, true));
      }

      // Build query with sorting
      let sessions;
      const sortOrder = input?.sortOrder || 'desc';
      const sortBy = input?.sortBy || 'updatedAt';

      if (sortBy === 'createdAt') {
        sessions = await db
          .select()
          .from(chatSessions)
          .where(and(...conditions))
          .orderBy(
            desc(chatSessions.isFavorite),
            sortOrder === 'asc' ? asc(chatSessions.createdAt) : desc(chatSessions.createdAt)
          );
      } else if (sortBy === 'messageCount') {
        sessions = await db
          .select()
          .from(chatSessions)
          .where(and(...conditions))
          .orderBy(
            desc(chatSessions.isFavorite),
            sortOrder === 'asc' ? asc(chatSessions.messageCount) : desc(chatSessions.messageCount)
          );
      } else {
        sessions = await db
          .select()
          .from(chatSessions)
          .where(and(...conditions))
          .orderBy(
            desc(chatSessions.isFavorite),
            sortOrder === 'asc' ? asc(chatSessions.updatedAt) : desc(chatSessions.updatedAt)
          );
      }

      return sessions;
    }),

  /**
   * Get a single chat session with all messages
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get the session
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, input.id),
            eq(chatSessions.userId, ctx.userId)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      // Get all messages for this session
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, input.id))
        .orderBy(asc(chatMessages.createdAt));

      return {
        session,
        messages,
      };
    }),

  /**
   * Create a new chat session
   */
  create: protectedProcedure
    .input(createSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const [newSession] = await db
        .insert(chatSessions)
        .values({
          userId: ctx.userId,
          title: input.title,
          agentId: input.agentId || null,
          isFavorite: false,
          messageCount: 0,
          lastMessagePreview: null,
        })
        .returning();

      return newSession;
    }),

  /**
   * Update a chat session (title)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, input.id),
            eq(chatSessions.userId, ctx.userId)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      // Update the session
      const [updatedSession] = await db
        .update(chatSessions)
        .set({
          title: input.title,
          updatedAt: new Date(),
        })
        .where(eq(chatSessions.id, input.id))
        .returning();

      return updatedSession;
    }),

  /**
   * Delete a chat session (and all its messages via cascade)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, input.id),
            eq(chatSessions.userId, ctx.userId)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      // Delete the session (messages cascade delete automatically)
      await db
        .delete(chatSessions)
        .where(eq(chatSessions.id, input.id));

      return { success: true };
    }),

  /**
   * Add a message to a chat session
   * Also updates the session's lastMessagePreview, messageCount, and updatedAt
   */
  addMessage: protectedProcedure
    .input(addMessageSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, input.sessionId),
            eq(chatSessions.userId, ctx.userId)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      // Insert the message
      const [newMessage] = await db
        .insert(chatMessages)
        .values({
          sessionId: input.sessionId,
          role: input.role,
          content: input.content,
          images: input.images || null,
          referencedRecipes: input.referencedRecipes || null,
          generatedRecipe: input.generatedRecipe || null,
        })
        .returning();

      // Generate preview text (first 100 chars of content)
      const preview = input.content.slice(0, 100);
      const previewWithRole = input.role === 'user' ? `You: ${preview}` : `AI: ${preview}`;

      // Update session metadata
      await db
        .update(chatSessions)
        .set({
          lastMessagePreview: previewWithRole,
          messageCount: session.messageCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(chatSessions.id, input.sessionId));

      return newMessage;
    }),

  /**
   * Delete a message from a chat session
   */
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get the message to verify ownership via session
      const [message] = await db
        .select({
          sessionId: chatMessages.sessionId,
        })
        .from(chatMessages)
        .where(eq(chatMessages.id, input.messageId))
        .limit(1);

      if (!message) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Message not found',
        });
      }

      // Verify session ownership
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, message.sessionId),
            eq(chatSessions.userId, ctx.userId)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this message',
        });
      }

      // Delete the message
      await db
        .delete(chatMessages)
        .where(eq(chatMessages.id, input.messageId));

      // Update message count and recalculate preview if needed
      const remainingMessages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, message.sessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);

      let lastMessagePreview = null;
      if (remainingMessages.length > 0) {
        const lastMsg = remainingMessages[0];
        const preview = lastMsg.content.slice(0, 100);
        lastMessagePreview = lastMsg.role === 'user' ? `You: ${preview}` : `AI: ${preview}`;
      }

      // Get the new message count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, message.sessionId));

      // Update session
      await db
        .update(chatSessions)
        .set({
          messageCount: count,
          lastMessagePreview,
          updatedAt: new Date(),
        })
        .where(eq(chatSessions.id, message.sessionId));

      return { success: true };
    }),

  /**
   * Toggle favorite status of a chat session
   */
  toggleFavorite: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, input.id),
            eq(chatSessions.userId, ctx.userId)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      // Toggle the favorite status
      const [updatedSession] = await db
        .update(chatSessions)
        .set({
          isFavorite: !session.isFavorite,
          updatedAt: new Date(),
        })
        .where(eq(chatSessions.id, input.id))
        .returning();

      return updatedSession;
    }),

  /**
   * Search chat sessions by title and message content
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2),
        searchIn: z.enum(['title', 'messages', 'both']).default('both'),
      })
    )
    .query(async ({ ctx, input }) => {
      const searchQuery = input.query.trim();

      if (input.searchIn === 'title' || input.searchIn === 'both') {
        // Search in session titles
        const titleResults = await db
          .select()
          .from(chatSessions)
          .where(
            and(
              eq(chatSessions.userId, ctx.userId),
              sql`to_tsvector('english', ${chatSessions.title}) @@ plainto_tsquery('english', ${searchQuery})`
            )
          )
          .orderBy(desc(chatSessions.updatedAt));

        if (input.searchIn === 'title') {
          return titleResults;
        }

        // If searching both, also search in messages
        const messageResults = await db
          .selectDistinct({
            id: chatSessions.id,
            userId: chatSessions.userId,
            title: chatSessions.title,
            agentId: chatSessions.agentId,
            isFavorite: chatSessions.isFavorite,
            lastMessagePreview: chatSessions.lastMessagePreview,
            messageCount: chatSessions.messageCount,
            createdAt: chatSessions.createdAt,
            updatedAt: chatSessions.updatedAt,
          })
          .from(chatSessions)
          .innerJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
          .where(
            and(
              eq(chatSessions.userId, ctx.userId),
              sql`to_tsvector('english', ${chatMessages.content}) @@ plainto_tsquery('english', ${searchQuery})`
            )
          )
          .orderBy(desc(chatSessions.updatedAt));

        // Combine and deduplicate results
        const allResults = [...titleResults, ...messageResults];
        const uniqueResults = Array.from(
          new Map(allResults.map(session => [session.id, session])).values()
        );

        // Sort by updatedAt DESC
        uniqueResults.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        return uniqueResults;
      } else {
        // Search only in messages
        const messageResults = await db
          .selectDistinct({
            id: chatSessions.id,
            userId: chatSessions.userId,
            title: chatSessions.title,
            agentId: chatSessions.agentId,
            isFavorite: chatSessions.isFavorite,
            lastMessagePreview: chatSessions.lastMessagePreview,
            messageCount: chatSessions.messageCount,
            createdAt: chatSessions.createdAt,
            updatedAt: chatSessions.updatedAt,
          })
          .from(chatSessions)
          .innerJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
          .where(
            and(
              eq(chatSessions.userId, ctx.userId),
              sql`to_tsvector('english', ${chatMessages.content}) @@ plainto_tsquery('english', ${searchQuery})`
            )
          )
          .orderBy(desc(chatSessions.updatedAt));

        return messageResults;
      }
    }),
});
