import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, tags, recipeTags, recipeCategories, recipeCategoryTags, users, DEFAULT_FEATURE_FLAGS } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, like, or, inArray, sql, desc, asc } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'crypto';
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
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  prepTime: z.number().min(0).optional(),
  cookTime: z.number().min(0).optional(),
  totalTime: z.number().min(0).optional(),
  servings: z.number().min(0).optional(),
  ingredients: recipeItemListSchema,
  instructions: recipeItemListSchema,
  imageUrl: z.string().url().optional().or(z.literal('')),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
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

    // Try to find existing tag for this user
    const [existing] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.name, trimmedName), eq(tags.userId, userId)))
      .limit(1);

    if (existing) {
      tagIds.push(existing.id);
    } else {
      // Create new tag for this user
      const [newTag] = await db.insert(tags).values({ name: trimmedName, userId }).returning();
      tagIds.push(newTag.id);
    }
  }

  return tagIds;
}

/**
 * Get tags for recipes
 */
async function getRecipesTags(recipeIds: string[]) {
  if (recipeIds.length === 0) return {};

  const recipesWithTags = await db
    .select({
      recipeId: recipeTags.recipeId,
      tagId: tags.id,
      tagName: tags.name,
    })
    .from(recipeTags)
    .innerJoin(tags, eq(recipeTags.tagId, tags.id))
    .where(inArray(recipeTags.recipeId, recipeIds));

  const tagsByRecipe: Record<string, Array<{ id: string; name: string }>> = {};
  for (const rt of recipesWithTags) {
    if (!tagsByRecipe[rt.recipeId]) {
      tagsByRecipe[rt.recipeId] = [];
    }
    tagsByRecipe[rt.recipeId].push({ id: rt.tagId, name: rt.tagName });
  }

  return tagsByRecipe;
}

// GET /api/recipes - List all recipes
export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const search = url.searchParams.get('search');
    const tagFilter = url.searchParams.get('tag');
    const categoryId = url.searchParams.get('categoryId');
    const favoriteOnly = url.searchParams.get('favorite') === 'true';
    const sortBy = url.searchParams.get('sortBy') || 'date-newest';
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    let limit = 50;
    let offset = 0;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 200) {
        limit = parsedLimit;
      }
    }
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam, 10);
      if (!isNaN(parsedOffset) && parsedOffset >= 0) {
        offset = parsedOffset;
      }
    }

    let query = db.select().from(recipes).where(eq(recipes.userId, user.userId));
    if (search) {
      query = db.select().from(recipes).where(
        and(
          eq(recipes.userId, user.userId),
          or(
            like(recipes.title, `%${search}%`),
            like(recipes.description || '', `%${search}%`)
          )
        )
      );
    }
    if (favoriteOnly) {
      query = db.select().from(recipes).where(
        and(
          eq(recipes.userId, user.userId),
          eq(recipes.isFavorite, true)
        )
      );
    }
    if (tagFilter) {
      query = query.innerJoin(recipeTags, eq(recipes.id, recipeTags.recipeId))
        .innerJoin(tags, eq(recipeTags.tagId, tags.id))
        .where(and(
          eq(tags.name, tagFilter),
          eq(tags.userId, user.userId)
        ));
    }
    if (categoryId) {
      const categoryTagRows = await db
        .select({ tagId: recipeCategoryTags.tagId })
        .from(recipeCategoryTags)
        .where(eq(recipeCategoryTags.categoryId, categoryId));
      const categoryTagIds = categoryTagRows.map(r => r.tagId);
      if (categoryTagIds.length > 0) {
        const recipeRows = await db
          .select({ recipeId: recipeTags.recipeId })
          .from(recipeTags)
          .where(inArray(recipeTags.tagId, categoryTagIds));
        const recipeIds = [...new Set(recipeRows.map(r => r.recipeId))];
        if (recipeIds.length > 0) {
          query = db.select().from(recipes).where(
            and(
              eq(recipes.userId, user.userId),
              inArray(recipes.id, recipeIds)
            )
          );
        } else {
          query = db.select().from(recipes).where(eq(recipes.id, 'never-match'));
        }
      } else {
        query = db.select().from(recipes).where(eq(recipes.id, 'never-match'));
      }
    }
    switch (sortBy) {
      case 'date-newest':
        query = query.orderBy(desc(recipes.createdAt));
        break;
      case 'date-oldest':
        query = query.orderBy(asc(recipes.createdAt));
        break;
      case 'title-asc':
        query = query.orderBy(asc(recipes.title));
        break;
      case 'title-desc':
        query = query.orderBy(desc(recipes.title));
        break;
      case 'rating-high':
        query = query.orderBy(desc(recipes.rating)).orderBy(desc(recipes.createdAt));
        break;
      case 'cooked-most':
        query = query.orderBy(desc(recipes.timesCooked)).orderBy(desc(recipes.createdAt));
        break;
      default:
        query = query.orderBy(desc(recipes.createdAt));
    }
    const allRecipes = await query.limit(limit).offset(offset);
    const tagsByRecipe = await getRecipesTags(allRecipes.map(r => r.id));
    const normalizedRecipes = allRecipes.map(recipe => {
      const normalized = normalizeRecipeData(recipe);
      return {
        ...normalized,
        tags: tagsByRecipe[recipe.id] || [],
      };
    });
    return json(normalizedRecipes);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List recipes error:', e);
    throw error(500, 'Internal server error');
  }
  };

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = recipeInputSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const data = result.data;
    const tagNames = data.tags || [];
    delete (data as any).tags;

    // Create recipe
    const [newRecipe] = await db.insert(recipes).values({
      ...data,
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

    return json({
      ...newRecipe,
      tags: tagNames,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Create recipe error:', e);
    throw error(500, 'Internal server error');
  }
};
