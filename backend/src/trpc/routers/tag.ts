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

  /**
   * Rename a tag
   */
  rename: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        newName: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      // Check if tag exists
      const [existing] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tag not found',
        });
      }

      // Check if new name already exists
      const [duplicate] = await db
        .select()
        .from(tags)
        .where(eq(tags.name, input.newName))
        .limit(1);

      if (duplicate && duplicate.id !== input.id) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A tag with this name already exists',
        });
      }

      // Rename the tag
      const [updated] = await db
        .update(tags)
        .set({ name: input.newName })
        .where(eq(tags.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete all orphaned tags (tags with no associated recipes)
   */
  cleanupOrphaned: protectedProcedure.mutation(async () => {
    // Find tags with no recipes
    const allTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        recipeCount: sql<number>`count(${recipeTags.recipeId})`,
      })
      .from(tags)
      .leftJoin(recipeTags, eq(tags.id, recipeTags.tagId))
      .groupBy(tags.id);

    const orphanedTags = allTags.filter((tag) => tag.recipeCount === 0);

    if (orphanedTags.length === 0) {
      return { deletedCount: 0, deletedTags: [] };
    }

    // Delete all orphaned tags
    const orphanedIds = orphanedTags.map((t) => t.id);
    await db.delete(tags).where(sql`${tags.id} IN (${sql.join(orphanedIds, sql`, `)})`);

    return {
      deletedCount: orphanedTags.length,
      deletedTags: orphanedTags.map((t) => t.name),
    };
  }),

  /**
   * Merge two tags (combine sourceTagId into targetTagId)
   */
  merge: protectedProcedure
    .input(
      z.object({
        sourceTagId: z.string(),
        targetTagId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.sourceTagId === input.targetTagId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot merge a tag with itself',
        });
      }

      // Check if both tags exist
      const [sourceTag] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, input.sourceTagId))
        .limit(1);

      const [targetTag] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, input.targetTagId))
        .limit(1);

      if (!sourceTag || !targetTag) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or both tags not found',
        });
      }

      // Get all recipes with the source tag
      const recipesWithSourceTag = await db
        .select()
        .from(recipeTags)
        .where(eq(recipeTags.tagId, input.sourceTagId));

      // For each recipe, check if it already has the target tag
      // If not, add it. If yes, skip it.
      for (const rt of recipesWithSourceTag) {
        const [existingTarget] = await db
          .select()
          .from(recipeTags)
          .where(
            sql`${recipeTags.recipeId} = ${rt.recipeId} AND ${recipeTags.tagId} = ${input.targetTagId}`
          )
          .limit(1);

        if (!existingTarget) {
          // Add target tag to this recipe
          await db.insert(recipeTags).values({
            recipeId: rt.recipeId,
            tagId: input.targetTagId,
          });
        }
      }

      // Delete all associations with source tag
      await db.delete(recipeTags).where(eq(recipeTags.tagId, input.sourceTagId));

      // Delete the source tag
      await db.delete(tags).where(eq(tags.id, input.sourceTagId));

      return { success: true, targetTag };
    }),
});
