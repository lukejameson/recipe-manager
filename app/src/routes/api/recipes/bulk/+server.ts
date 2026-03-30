import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, tags, recipeTags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Recipe item schema for structured ingredients/instructions
const recipeItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1, 'Item cannot be empty'),
  order: z.number().int().min(0),
});

const recipeItemListSchema = z.object({
  items: z.array(recipeItemSchema)
});

// Nutrition schema
const nutritionSchema = z.object({
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbohydrates: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  saturatedFat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
  sugar: z.number().min(0).optional(),
  sodium: z.number().min(0).optional(),
  cholesterol: z.number().min(0).optional(),
});

const bulkCreateSchema = z.object({
  recipes: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    prepTime: z.number().optional(),
    cookTime: z.number().optional(),
    totalTime: z.number().optional(),
    servings: z.number().optional(),
    ingredients: recipeItemListSchema,
    instructions: recipeItemListSchema,
    imageUrl: z.string().optional(),
    sourceUrl: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isFavorite: z.boolean().optional(),
    rating: z.number().min(1).max(5).optional(),
    notes: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    nutrition: nutritionSchema.optional(),
  })),
});

/**
 * Get or create tags by name for a specific user
 */
async function getOrCreateTags(tagNames: string[], userId: string): Promise<string[]> {
  const tagIds: string[] = [];

  for (const tagName of tagNames) {
    const trimmedName = tagName.trim();
    if (!trimmedName) continue;

    const [existing] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.name, trimmedName), eq(tags.userId, userId)))
      .limit(1);

    if (existing) {
      tagIds.push(existing.id);
    } else {
      const [newTag] = await db.insert(tags).values({ name: trimmedName, userId }).returning();
      tagIds.push(newTag.id);
    }
  }

  return tagIds;
}

// POST /api/recipes/bulk - Bulk create recipes
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = bulkCreateSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { recipes: recipesData } = result.data;
    const createdRecipes = [];

    for (const recipeData of recipesData) {
      const tagNames = recipeData.tags || [];
      const { tags: _, ...recipeWithoutTags } = recipeData;

      // Create recipe
      const [newRecipe] = await db.insert(recipes).values({
        ...recipeWithoutTags,
        userId: user.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // Handle tags
      if (tagNames.length > 0) {
        const tagIds = await getOrCreateTags(tagNames, user.userId);
        for (const tagId of tagIds) {
          await db.insert(recipeTags).values({
            recipeId: newRecipe.id,
            tagId,
          });
        }
      }

      createdRecipes.push({
        ...newRecipe,
        tags: tagNames,
      });
    }

    return json({
      success: true,
      count: createdRecipes.length,
      recipes: createdRecipes,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Bulk create recipes error:', e);
    throw error(500, 'Internal server error');
  }
};
