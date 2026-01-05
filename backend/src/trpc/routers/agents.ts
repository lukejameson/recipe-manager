import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { agents } from '../../db/schema.js';
import { eq, and, or } from 'drizzle-orm';

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
const agentInputSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters').max(10000, 'System prompt must be 10000 characters or less'),
  icon: z.string().max(50).default('🤖'),
  modelId: z.string().max(100).optional(), // Specific model ID, null = use default from settings
});

export const agentsRouter = t.router({
  /**
   * List all available agents (built-in + user's custom)
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const allAgents = await db
      .select()
      .from(agents)
      .where(
        or(
          eq(agents.isBuiltIn, true),
          eq(agents.userId, ctx.userId)
        )
      )
      .orderBy(agents.isBuiltIn, agents.createdAt);

    return allAgents;
  }),

  /**
   * Get a single agent by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [agent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, input.id),
            or(
              eq(agents.isBuiltIn, true),
              eq(agents.userId, ctx.userId)
            )
          )
        )
        .limit(1);

      if (!agent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent not found',
        });
      }

      return agent;
    }),

  /**
   * Create a new custom agent
   */
  create: protectedProcedure
    .input(agentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [newAgent] = await db
        .insert(agents)
        .values({
          ...input,
          userId: ctx.userId,
          isBuiltIn: false,
        })
        .returning();

      return newAgent;
    }),

  /**
   * Update a custom agent (only owner can update, cannot update built-in)
   */
  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(agentInputSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify ownership and not built-in
      const [existing] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, id),
            eq(agents.userId, ctx.userId),
            eq(agents.isBuiltIn, false)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent not found or cannot be modified',
        });
      }

      const [updated] = await db
        .update(agents)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning();

      return updated;
    }),

  /**
   * Delete a custom agent (only owner can delete, cannot delete built-in)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and not built-in
      const [existing] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, input.id),
            eq(agents.userId, ctx.userId),
            eq(agents.isBuiltIn, false)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent not found or cannot be deleted',
        });
      }

      await db.delete(agents).where(eq(agents.id, input.id));

      return { success: true };
    }),
});
