import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, tags, recipeTags, users, DEFAULT_FEATURE_FLAGS } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, like, or, inArray, sql, desc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema
const recipeInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  prepTime: z.number().min(0).optional(),
  cookTime: z.number().min(0).optional(),
  totalTime: z.number().min(0).optional(),
  servings: z.number().min(1).optional(),
  ingredients: z.array(z.string()).min(1),
  instructions: z.array(z.string()).min(1),
  imageUrl: z.string().url().optional().or(z.literal('')),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
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
    const favoriteOnly = url.searchParams.get('favorite') === 'true';

    let query = db.select().from(recipes).where(eq(recipes.userId, user.userId));

    // Apply search filter
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

    // Apply favorite filter
    if (favoriteOnly) {
      query = db.select().from(recipes).where(
        and(
          eq(recipes.userId, user.userId),
          eq(recipes.isFavorite, true)
        )
      );
    }

    // Get all recipes
    let allRecipes = await query.orderBy(desc(recipes.createdAt));

    // Apply tag filter (post-query since we need to check tags)
    if (tagFilter) {
      const tagRecipes = await db
        .select({ recipeId: recipeTags.recipeId })
        .from(recipeTags)
        .innerJoin(tags, eq(recipeTags.tagId, tags.id))
        .where(and(
          eq(tags.name, tagFilter),
          eq(tags.userId, user.userId)
        ));

      const recipeIdsWithTag = new Set(tagRecipes.map(tr => tr.recipeId));
      allRecipes = allRecipes.filter(r => recipeIdsWithTag.has(r.id));
    }

    // Get tags for all recipes
    const tagsByRecipe = await getRecipesTags(allRecipes.map(r => r.id));

    return json(allRecipes.map(recipe => ({
      ...recipe,
      tags: tagsByRecipe[recipe.id] || [],
    })));
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List recipes error:', e);
    throw error(500, 'Internal server error');
  }
};

// POST /api/recipes - Create a new recipe
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
