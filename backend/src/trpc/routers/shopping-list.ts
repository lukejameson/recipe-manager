import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { shoppingListItems, recipes } from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

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

export const shoppingListRouter = t.router({
  /**
   * Get all shopping list items
   */
  list: protectedProcedure.query(async () => {
    return await db.select().from(shoppingListItems);
  }),

  /**
   * Add item to shopping list
   */
  addItem: protectedProcedure
    .input(
      z.object({
        ingredient: z.string(),
        quantity: z.string().optional(),
        category: z.string().optional(),
        recipeId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [newItem] = await db.insert(shoppingListItems).values(input).returning();
      return newItem;
    }),

  /**
   * Generate shopping list from recipe IDs
   */
  generateFromRecipes: protectedProcedure
    .input(z.object({ recipeIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      // Get all selected recipes
      const selectedRecipes = await db
        .select()
        .from(recipes)
        .where(inArray(recipes.id, input.recipeIds));

      // Collect all ingredients
      const allIngredients: { ingredient: string; recipeId: string }[] = [];

      for (const recipe of selectedRecipes) {
        for (const ingredient of recipe.ingredients) {
          allIngredients.push({
            ingredient,
            recipeId: recipe.id,
          });
        }
      }

      // Add to shopping list
      const addedItems = [];
      for (const item of allIngredients) {
        const [newItem] = await db
          .insert(shoppingListItems)
          .values({
            ingredient: item.ingredient,
            recipeId: item.recipeId,
            category: categorizeIngredient(item.ingredient),
          })
          .returning();
        addedItems.push(newItem);
      }

      return addedItems;
    }),

  /**
   * Toggle item checked status
   */
  toggleChecked: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [item] = await db
        .select()
        .from(shoppingListItems)
        .where(eq(shoppingListItems.id, input.id))
        .limit(1);

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      const [updated] = await db
        .update(shoppingListItems)
        .set({ isChecked: !item.isChecked })
        .where(eq(shoppingListItems.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete shopping list item
   */
  deleteItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(shoppingListItems).where(eq(shoppingListItems.id, input.id));
      return { success: true };
    }),

  /**
   * Clear all checked items
   */
  clearChecked: protectedProcedure.mutation(async () => {
    await db.delete(shoppingListItems).where(eq(shoppingListItems.isChecked, true));
    return { success: true };
  }),

  /**
   * Clear entire shopping list
   */
  clearAll: protectedProcedure.mutation(async () => {
    await db.delete(shoppingListItems);
    return { success: true };
  }),
});

/**
 * Categorize ingredient by keywords
 */
function categorizeIngredient(ingredient: string): string {
  const lower = ingredient.toLowerCase();

  const categories: Record<string, string[]> = {
    produce: [
      'lettuce', 'tomato', 'potato', 'onion', 'garlic', 'carrot', 'celery',
      'pepper', 'cucumber', 'spinach', 'broccoli', 'cauliflower', 'apple',
      'banana', 'orange', 'lemon', 'lime', 'berry', 'fruit', 'vegetable',
    ],
    dairy: [
      'milk', 'cheese', 'butter', 'cream', 'yogurt', 'sour cream', 'egg',
    ],
    meat: [
      'chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'shrimp',
      'bacon', 'sausage', 'ham',
    ],
    pantry: [
      'flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'rice', 'pasta',
      'bread', 'cereal', 'oats', 'honey', 'syrup', 'spice', 'herb',
    ],
    frozen: ['frozen', 'ice cream'],
    bakery: ['bread', 'bun', 'roll', 'bagel', 'tortilla'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }

  return 'other';
}
