import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { tags, recipeTags } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

const t = initTRPC.context<Context>().create();

// Middleware to check authentication
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

const protectedProcedure = t.procedure.use(isAuthenticated);

export const tagRouter = t.router({
  /**
   * List all tags with recipe counts
   */
  list: protectedProcedure.query(async () => {
    const allTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        createdAt: tags.createdAt,
        recipeCount: sql<number>`count(${recipeTags.recipeId})`,
      })
      .from(tags)
      .leftJoin(recipeTags, eq(tags.id, recipeTags.tagId))
      .groupBy(tags.id)
      .orderBy(tags.name);

    return allTags;
  }),

  /**
   * Create a new tag
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      // Check if tag already exists
      const [existing] = await db
        .select()
        .from(tags)
        .where(eq(tags.name, input.name))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Tag already exists',
        });
      }

      const [newTag] = await db.insert(tags).values({ name: input.name }).returning();

      return newTag;
    }),

  /**
   * Delete a tag (only if no recipes use it)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Check if any recipes use this tag
      const recipesWithTag = await db
        .select()
        .from(recipeTags)
        .where(eq(recipeTags.tagId, input.id))
        .limit(1);

      if (recipesWithTag.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete tag that is in use by recipes',
        });
      }

      await db.delete(tags).where(eq(tags.id, input.id));

      return { success: true };
    }),
});
