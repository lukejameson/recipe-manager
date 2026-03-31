import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, tags, recipeTags, recipeComponents } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { normalizeRecipeData } from '$lib/utils/recipe-helpers';

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

// Validation schema
const recipeInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  prepTime: z.number().min(0).optional(),
  cookTime: z.number().min(0).optional(),
  totalTime: z.number().min(0).optional(),
  servings: z.number().min(1).optional(),
  ingredients: recipeItemListSchema.optional(),
  instructions: recipeItemListSchema.optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  timesCooked: z.number().min(0).optional(),
  lastCookedAt: z.string().datetime().optional().nullable(),
  nutrition: nutritionSchema.optional(),
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

/**
 * Get tags for a recipe
 */
async function getRecipeTags(recipeId: string): Promise<string[]> {
  const recipesWithTags = await db
    .select({
      name: tags.name,
    })
    .from(recipeTags)
    .innerJoin(tags, eq(recipeTags.tagId, tags.id))
    .where(eq(recipeTags.recipeId, recipeId));

  return recipesWithTags.map(rt => rt.name);
}

// GET /api/recipes/[id] - Get a specific recipe
export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    if (!params.id) {
      throw error(400, 'Recipe ID is required');
    }
    const recipe = await db.query.recipes.findFirst({
      where: and(
        eq(recipes.id, params.id),
        eq(recipes.userId, user.userId)
      ),
    });

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    // Get tags
    const recipeTagNames = await getRecipeTags(recipe.id);

    // Get components (sub-recipes)
    const components = await db
      .select({
        id: recipeComponents.id,
        childRecipeId: recipeComponents.childRecipeId,
        servingsNeeded: recipeComponents.servingsNeeded,
        sortOrder: recipeComponents.sortOrder,
      })
      .from(recipeComponents)
      .where(eq(recipeComponents.parentRecipeId, recipe.id));

    // Normalize recipe data to ensure proper structure
    const normalizedRecipe = normalizeRecipeData(recipe);

    return json({
      ...normalizedRecipe,
      tags: recipeTagNames,
      components,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get recipe error:', e);
    throw error(500, 'Internal server error');
  }
};

// PUT /api/recipes/[id] - Update a recipe
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    if (!params.id) {
      throw error(400, 'Recipe ID is required');
    }
    const [existing] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.userId, user.userId)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Recipe not found');
    }

    const body = await request.json();
    const result = recipeInputSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const data = result.data;
    const tagNames = data.tags;
    delete (data as any).tags;

    // Update recipe
    const [updated] = await db
      .update(recipes)
      .set({
        ...data,
        updatedAt: new Date(),
        lastCookedAt: data.lastCookedAt ? new Date(data.lastCookedAt) : undefined,
      })
      .where(eq(recipes.id, params.id))
      .returning();

    // Handle tags if provided
    if (tagNames !== undefined) {
      // Remove existing tags
      await db.delete(recipeTags).where(eq(recipeTags.recipeId, params.id));

      // Add new tags
      if (tagNames.length > 0) {
        const tagIds = await getOrCreateTags(tagNames, user.userId);
        for (const tagId of tagIds) {
          await db.insert(recipeTags).values({
            recipeId: params.id,
            tagId,
          });
        }
      }
    }

    const recipeTagNames = tagNames !== undefined ? tagNames : await getRecipeTags(params.id);

    return json({
      ...updated,
      tags: recipeTagNames,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update recipe error:', e);
    throw error(500, 'Internal server error');
  }
};

// DELETE /api/recipes/[id] - Delete a recipe
export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    if (!params.id) {
      throw error(400, 'Recipe ID is required');
    }
    const [existing] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.userId, user.userId)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Recipe not found');
    }

    // Delete recipe (cascades to tags and components)
    await db.delete(recipes).where(eq(recipes.id, params.id));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete recipe error:', e);
    throw error(500, 'Internal server error');
  }
};
