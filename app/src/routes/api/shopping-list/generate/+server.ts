import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { shoppingListItems, recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

// POST /api/shopping-list/generate - Generate shopping list from recipe IDs
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({ recipeIds: z.array(z.string()) });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { recipeIds } = result.data;

    // Get all selected recipes (only user's recipes)
    const selectedRecipes = await db
      .select()
      .from(recipes)
      .where(and(
        inArray(recipes.id, recipeIds),
        eq(recipes.userId, user.id)
      ));

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
          userId: user.id,
          category: categorizeIngredient(item.ingredient),
          isChecked: false,
        })
        .returning();
      addedItems.push(newItem);
    }

    return json(addedItems);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Generate shopping list error:', e);
    throw error(500, 'Internal server error');
  }
};

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
