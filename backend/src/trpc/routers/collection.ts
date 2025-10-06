import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { collections, collectionRecipes, recipes } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

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
  list: protectedProcedure.query(async () => {
    const allCollections = await db.select().from(collections);

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
    .query(async ({ input }) => {
      const [collection] = await db
        .select()
        .from(collections)
        .where(eq(collections.id, input.id))
        .limit(1);

      if (!collection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        });
      }

      // Get recipes in this collection
      const collectionRecipesData = await db
        .select({
          recipe: recipes,
          addedAt: collectionRecipes.addedAt,
        })
        .from(collectionRecipes)
        .innerJoin(recipes, eq(collectionRecipes.recipeId, recipes.id))
        .where(eq(collectionRecipes.collectionId, input.id));

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
    .mutation(async ({ input }) => {
      const [newCollection] = await db
        .insert(collections)
        .values(input)
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
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      const [updated] = await db
        .update(collections)
        .set(data)
        .where(eq(collections.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        });
      }

      return updated;
    }),

  /**
   * Delete a collection
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
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
    .mutation(async ({ input }) => {
      // Check if already exists
      const [existing] = await db
        .select()
        .from(collectionRecipes)
        .where(
          eq(collectionRecipes.collectionId, input.collectionId) &&
            eq(collectionRecipes.recipeId, input.recipeId)
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
    .mutation(async ({ input }) => {
      await db
        .delete(collectionRecipes)
        .where(
          eq(collectionRecipes.collectionId, input.collectionId) &&
            eq(collectionRecipes.recipeId, input.recipeId)
        );

      return { success: true };
    }),
});
