import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { recipes, tags, recipeTags } from '../../db/schema.js';
import { eq, like, or, inArray, sql } from 'drizzle-orm';
import { parseRecipeJsonLd } from '../../utils/jsonld-parser.js';
import { convertRecipeIngredients } from '../../utils/unit-converter.js';

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

// Validation schemas
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
  tags: z.array(z.string()),
});

/**
 * Get or create tags by name
 */
async function getOrCreateTags(tagNames: string[]): Promise<string[]> {
  const tagIds: string[] = [];

  for (const tagName of tagNames) {
    // Try to find existing tag
    const [existing] = await db
      .select()
      .from(tags)
      .where(eq(tags.name, tagName))
      .limit(1);

    if (existing) {
      tagIds.push(existing.id);
    } else {
      // Create new tag
      const [newTag] = await db.insert(tags).values({ name: tagName }).returning();
      tagIds.push(newTag.id);
    }
  }

  return tagIds;
}

/**
 * Get tags for a recipe
 */
async function getRecipeTags(recipeId: string) {
  const recipesWithTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      createdAt: tags.createdAt,
    })
    .from(recipeTags)
    .innerJoin(tags, eq(recipeTags.tagId, tags.id))
    .where(eq(recipeTags.recipeId, recipeId));

  return recipesWithTags;
}

/**
 * Extract JSONLD from HTML page
 */
function extractJsonLdFromHtml(html: string): string | null {
  // Look for script tags with type="application/ld+json"
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = [...html.matchAll(scriptRegex)];

  for (const match of matches) {
    try {
      const jsonContent = match[1].trim();
      const parsed = JSON.parse(jsonContent);

      // Check if it's a Recipe or contains a Recipe
      if (parsed['@type'] === 'Recipe') {
        return jsonContent;
      }

      // Check in @graph
      if (parsed['@graph']) {
        const recipe = parsed['@graph'].find((item: any) => item['@type'] === 'Recipe');
        if (recipe) {
          return JSON.stringify(recipe);
        }
      }

      // Check if it's an array
      if (Array.isArray(parsed)) {
        const recipe = parsed.find((item: any) => item['@type'] === 'Recipe');
        if (recipe) {
          return JSON.stringify(recipe);
        }
      }
    } catch (e) {
      // Continue to next script tag
      continue;
    }
  }

  return null;
}

export const recipeRouter = t.router({
  /**
   * List recipes with optional filtering
   */
  list: protectedProcedure
    .input(
      z
        .object({
          tags: z.array(z.string()).optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      let query = db.select().from(recipes);

      // Filter by search term
      if (input?.search) {
        const searchTerm = `%${input.search}%`;
        query = query.where(
          or(
            like(recipes.title, searchTerm),
            like(recipes.description, searchTerm)
          )
        ) as any;
      }

      let allRecipes = await query;

      // Filter by tags if specified
      if (input?.tags && input.tags.length > 0) {
        // Get tag IDs for the specified tag names
        const tagRecords = await db
          .select()
          .from(tags)
          .where(inArray(tags.name, input.tags));

        const tagIds = tagRecords.map((t) => t.id);

        if (tagIds.length === 0) {
          return [];
        }

        // Get recipes that have ALL specified tags
        const recipesWithTags = await db
          .select({ recipeId: recipeTags.recipeId })
          .from(recipeTags)
          .where(inArray(recipeTags.tagId, tagIds))
          .groupBy(recipeTags.recipeId)
          .having(sql`count(DISTINCT ${recipeTags.tagId}) = ${tagIds.length}`);

        const recipeIds = recipesWithTags.map((r) => r.recipeId);

        if (recipeIds.length === 0) {
          return [];
        }

        allRecipes = allRecipes.filter((r) => recipeIds.includes(r.id));
      }

      // Get tags for each recipe
      const recipesWithTags = await Promise.all(
        allRecipes.map(async (recipe) => ({
          ...recipe,
          tags: await getRecipeTags(recipe.id),
        }))
      );

      return recipesWithTags;
    }),

  /**
   * Get a single recipe by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.id))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recipe not found',
        });
      }

      const recipeTags = await getRecipeTags(recipe.id);

      return {
        ...recipe,
        tags: recipeTags,
      };
    }),

  /**
   * Create a new recipe
   */
  create: protectedProcedure
    .input(recipeInputSchema)
    .mutation(async ({ input }) => {
      const { tags: tagNames, ...recipeData } = input;

      // Create recipe
      const [newRecipe] = await db
        .insert(recipes)
        .values({
          ...recipeData,
          imageUrl: recipeData.imageUrl || null,
          sourceUrl: recipeData.sourceUrl || null,
        })
        .returning();

      // Associate tags
      if (tagNames.length > 0) {
        const tagIds = await getOrCreateTags(tagNames);

        await db.insert(recipeTags).values(
          tagIds.map((tagId) => ({
            recipeId: newRecipe.id,
            tagId,
          }))
        );
      }

      const tagsForRecipe = await getRecipeTags(newRecipe.id);

      return {
        ...newRecipe,
        tags: tagsForRecipe,
      };
    }),

  /**
   * Update an existing recipe
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: recipeInputSchema.partial(),
      })
    )
    .mutation(async ({ input }) => {
      // Check if recipe exists
      const [existing] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recipe not found',
        });
      }

      const { tags: tagNames, ...recipeData } = input.data;

      // Update recipe
      const [updatedRecipe] = await db
        .update(recipes)
        .set({
          ...recipeData,
          imageUrl: recipeData.imageUrl === '' ? null : recipeData.imageUrl,
          sourceUrl: recipeData.sourceUrl === '' ? null : recipeData.sourceUrl,
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, input.id))
        .returning();

      // Update tags if provided
      if (tagNames !== undefined) {
        // Remove existing tag associations
        await db.delete(recipeTags).where(eq(recipeTags.recipeId, input.id));

        // Add new tag associations
        if (tagNames.length > 0) {
          const tagIds = await getOrCreateTags(tagNames);

          await db.insert(recipeTags).values(
            tagIds.map((tagId) => ({
              recipeId: input.id,
              tagId,
            }))
          );
        }
      }

      const tagsForRecipe = await getRecipeTags(updatedRecipe.id);

      return {
        ...updatedRecipe,
        tags: tagsForRecipe,
      };
    }),

  /**
   * Delete a recipe
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Check if recipe exists
      const [existing] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recipe not found',
        });
      }

      // Delete recipe (cascade will delete recipe_tags)
      await db.delete(recipes).where(eq(recipes.id, input.id));

      return { success: true };
    }),

  /**
   * Fetch recipe from URL and parse JSONLD (without saving)
   */
  fetchFromUrl: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        convertToMetric: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Fetch the page
        const response = await fetch(input.url);

        if (!response.ok) {
          throw new Error(`Failed to fetch page: ${response.statusText}`);
        }

        const html = await response.text();

        // Extract JSONLD from page
        const jsonld = extractJsonLdFromHtml(html);

        if (!jsonld) {
          throw new Error('No Recipe JSONLD found on this page');
        }

        // Parse the JSONLD
        const recipeData = parseRecipeJsonLd(jsonld);

        // Convert to metric if requested
        if (input.convertToMetric) {
          recipeData.ingredients = convertRecipeIngredients(recipeData.ingredients);
        }

        // Return parsed data without saving
        return recipeData;
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to fetch and parse recipe from URL',
        });
      }
    }),

  /**
   * Import a recipe from JSONLD
   */
  importJsonLd: protectedProcedure
    .input(
      z.object({
        jsonld: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Parse JSONLD
        const recipeData = parseRecipeJsonLd(input.jsonld);

        // Create recipe using the parsed data
        const { tags: tagNames, ...recipeFields } = recipeData;

        const [newRecipe] = await db
          .insert(recipes)
          .values({
            ...recipeFields,
            imageUrl: recipeFields.imageUrl || null,
            sourceUrl: recipeFields.sourceUrl || null,
          })
          .returning();

        // Associate tags
        if (tagNames.length > 0) {
          const tagIds = await getOrCreateTags(tagNames);

          await db.insert(recipeTags).values(
            tagIds.map((tagId) => ({
              recipeId: newRecipe.id,
              tagId,
            }))
          );
        }

        const tagsForRecipe = await getRecipeTags(newRecipe.id);

        return {
          ...newRecipe,
          tags: tagsForRecipe,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to import recipe from JSONLD',
        });
      }
    }),
});
