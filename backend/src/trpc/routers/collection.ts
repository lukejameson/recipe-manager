import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { collections, collectionRecipes, recipes } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

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

export const collectionRouter = t.router({
  /**
   * List all collections with recipe counts
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const allCollections = await db
      .select()
      .from(collections)
      .where(eq(collections.userId, ctx.userId));

    // Get recipe counts for each collection
    const collectionsWithCounts = await Promise.all(
      allCollections.map(async (collection) => {
        const recipeCount = await db
          .select()
          .from(collectionRecipes)
          .where(eq(collectionRecipes.collectionId, collection.id));

        return {
          ...collection,
          recipeCount: recipeCount.length,
        };
      })
    );

    return collectionsWithCounts;
  }),

  /**
   * Get a collection with its recipes
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [collection] = await db
        .select()
        .from(collections)
        .where(and(eq(collections.id, input.id), eq(collections.userId, ctx.userId)))
        .limit(1);

      if (!collection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        });
      }

      // Get recipes in this collection (only user's recipes)
      const collectionRecipesData = await db
        .select({
          recipe: recipes,
          addedAt: collectionRecipes.addedAt,
        })
        .from(collectionRecipes)
        .innerJoin(recipes, eq(collectionRecipes.recipeId, recipes.id))
        .where(and(
          eq(collectionRecipes.collectionId, input.id),
          eq(recipes.userId, ctx.userId)
        ));

      return {
        ...collection,
        recipes: collectionRecipesData.map((cr) => ({
          ...cr.recipe,
          addedAt: cr.addedAt,
        })),
      };
    }),

  /**
   * Create a new collection
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [newCollection] = await db
        .insert(collections)
        .values({ ...input, userId: ctx.userId })
        .returning();

      return newCollection;
    }),

  /**
   * Update a collection
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(collections)
        .where(and(eq(collections.id, id), eq(collections.userId, ctx.userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        });
      }

      const [updated] = await db
        .update(collections)
        .set(data)
        .where(eq(collections.id, id))
        .returning();

      return updated;
    }),

  /**
   * Delete a collection
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await db
        .select()
        .from(collections)
        .where(and(eq(collections.id, input.id), eq(collections.userId, ctx.userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        });
      }

      await db.delete(collections).where(eq(collections.id, input.id));
      return { success: true };
    }),

  /**
   * Add recipe to collection
   */
  addRecipe: protectedProcedure
    .input(
      z.object({
        collectionId: z.string(),
        recipeId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify collection belongs to user
      const [collection] = await db
        .select()
        .from(collections)
        .where(and(eq(collections.id, input.collectionId), eq(collections.userId, ctx.userId)))
        .limit(1);

      if (!collection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        });
      }

      // Verify recipe belongs to user
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, input.recipeId), eq(recipes.userId, ctx.userId)))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recipe not found',
        });
      }

      // Check if already exists
      const [existing] = await db
        .select()
        .from(collectionRecipes)
        .where(
          and(
            eq(collectionRecipes.collectionId, input.collectionId),
            eq(collectionRecipes.recipeId, input.recipeId)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Recipe already in collection',
        });
      }

      await db.insert(collectionRecipes).values(input);

      return { success: true };
    }),

  /**
   * Remove recipe from collection
   */
  removeRecipe: protectedProcedure
    .input(
      z.object({
        collectionId: z.string(),
        recipeId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify collection belongs to user
      const [collection] = await db
        .select()
        .from(collections)
        .where(and(eq(collections.id, input.collectionId), eq(collections.userId, ctx.userId)))
        .limit(1);

      if (!collection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        });
      }

      await db
        .delete(collectionRecipes)
        .where(
          and(
            eq(collectionRecipes.collectionId, input.collectionId),
            eq(collectionRecipes.recipeId, input.recipeId)
          )
        );

      return { success: true };
    }),
});
