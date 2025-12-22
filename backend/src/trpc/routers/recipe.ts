import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { recipes, tags, recipeTags, recipeComponents, type NutritionInfo, type ImprovementSuggestion } from '../../db/schema.js';
import { eq, like, or, inArray, sql, and } from 'drizzle-orm';
import { parseRecipeJsonLd } from '../../utils/jsonld-parser.js';
import { convertRecipeIngredients, cleanRecipeInstructions } from '../../utils/unit-converter.js';

/**
 * Validate URL to prevent SSRF attacks
 * Only allows HTTPS URLs to public internet addresses
 */
function isAllowedUrl(urlString: string): { allowed: boolean; reason?: string } {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      return { allowed: false, reason: 'Only HTTPS URLs are allowed' };
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost and loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { allowed: false, reason: 'Localhost URLs are not allowed' };
    }

    // Block private IP ranges
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      // 10.x.x.x
      if (a === 10) return { allowed: false, reason: 'Private IP addresses are not allowed' };
      // 172.16.x.x - 172.31.x.x
      if (a === 172 && b >= 16 && b <= 31) return { allowed: false, reason: 'Private IP addresses are not allowed' };
      // 192.168.x.x
      if (a === 192 && b === 168) return { allowed: false, reason: 'Private IP addresses are not allowed' };
      // 169.254.x.x (link-local, includes AWS metadata)
      if (a === 169 && b === 254) return { allowed: false, reason: 'Link-local addresses are not allowed' };
      // 0.x.x.x
      if (a === 0) return { allowed: false, reason: 'Invalid IP address' };
    }

    // Block cloud metadata endpoints
    const blockedHosts = [
      'metadata.google.internal',
      'metadata.gke.internal',
      '169.254.169.254', // AWS/GCP/Azure metadata
    ];
    if (blockedHosts.includes(hostname)) {
      return { allowed: false, reason: 'Cloud metadata endpoints are not allowed' };
    }

    // Block internal TLDs
    const blockedTlds = ['.local', '.internal', '.localhost', '.intranet'];
    if (blockedTlds.some(tld => hostname.endsWith(tld))) {
      return { allowed: false, reason: 'Internal domain names are not allowed' };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: 'Invalid URL format' };
  }
}

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

// Nutrition schema for validation
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
}).optional();

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
  isFavorite: z.boolean().optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  nutrition: nutritionSchema,
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
 * Get components for a recipe
 */
async function getRecipeComponents(recipeId: string) {
  const components = await db
    .select({
      id: recipeComponents.id,
      childRecipeId: recipeComponents.childRecipeId,
      servingsNeeded: recipeComponents.servingsNeeded,
      sortOrder: recipeComponents.sortOrder,
      childRecipe: recipes,
    })
    .from(recipeComponents)
    .innerJoin(recipes, eq(recipeComponents.childRecipeId, recipes.id))
    .where(eq(recipeComponents.parentRecipeId, recipeId))
    .orderBy(recipeComponents.sortOrder);

  return components;
}

/**
 * Check if adding a child recipe would create a circular reference
 * This recursively checks if the potential child contains the parent as a descendant
 */
async function wouldCreateCircularReference(
  parentId: string,
  childId: string,
  visited: Set<string> = new Set()
): Promise<boolean> {
  // Direct self-reference
  if (parentId === childId) return true;

  // Already visited this node (handles cycles in existing data)
  if (visited.has(childId)) return false;
  visited.add(childId);

  // Get all children of the potential child recipe
  const childComponents = await db
    .select({ childRecipeId: recipeComponents.childRecipeId })
    .from(recipeComponents)
    .where(eq(recipeComponents.parentRecipeId, childId));

  for (const component of childComponents) {
    // If any descendant of the child is the parent, it would be circular
    if (component.childRecipeId === parentId) return true;

    // Recursively check deeper levels
    if (await wouldCreateCircularReference(parentId, component.childRecipeId, visited)) {
      return true;
    }
  }

  return false;
}

/**
 * Recursively get full component hierarchy for a recipe
 */
export type ComponentWithHierarchy = {
  id: string;
  childRecipeId: string;
  servingsNeeded: number;
  sortOrder: number;
  childRecipe: typeof recipes.$inferSelect & {
    tags?: { id: string; name: string; createdAt: Date }[];
    components?: ComponentWithHierarchy[];
  };
};

async function getRecipeHierarchy(
  recipeId: string,
  visited: Set<string> = new Set()
): Promise<ComponentWithHierarchy[]> {
  // Prevent infinite loops in case of circular references
  if (visited.has(recipeId)) return [];
  visited.add(recipeId);

  const components = await getRecipeComponents(recipeId);

  const hierarchicalComponents: ComponentWithHierarchy[] = await Promise.all(
    components.map(async (comp) => {
      const childTags = await getRecipeTags(comp.childRecipeId);
      const nestedComponents = await getRecipeHierarchy(comp.childRecipeId, new Set(visited));

      return {
        id: comp.id,
        childRecipeId: comp.childRecipeId,
        servingsNeeded: comp.servingsNeeded,
        sortOrder: comp.sortOrder,
        childRecipe: {
          ...comp.childRecipe,
          tags: childTags,
          components: nestedComponents.length > 0 ? nestedComponents : undefined,
        },
      };
    })
  );

  return hierarchicalComponents;
}

/**
 * Calculate aggregated nutrition from components
 */
function aggregateNutrition(
  components: ComponentWithHierarchy[],
  ownNutrition?: NutritionInfo | null
): NutritionInfo | undefined {
  const result: NutritionInfo = {};

  // Helper to add scaled nutrition
  const addScaledNutrition = (
    nutrition: NutritionInfo | null | undefined,
    childServings: number | null | undefined,
    servingsNeeded: number
  ) => {
    if (!nutrition || !childServings) return;
    const scale = servingsNeeded / childServings;

    if (nutrition.calories !== undefined) {
      result.calories = (result.calories || 0) + nutrition.calories * scale;
    }
    if (nutrition.protein !== undefined) {
      result.protein = (result.protein || 0) + nutrition.protein * scale;
    }
    if (nutrition.carbohydrates !== undefined) {
      result.carbohydrates = (result.carbohydrates || 0) + nutrition.carbohydrates * scale;
    }
    if (nutrition.fat !== undefined) {
      result.fat = (result.fat || 0) + nutrition.fat * scale;
    }
    if (nutrition.saturatedFat !== undefined) {
      result.saturatedFat = (result.saturatedFat || 0) + nutrition.saturatedFat * scale;
    }
    if (nutrition.fiber !== undefined) {
      result.fiber = (result.fiber || 0) + nutrition.fiber * scale;
    }
    if (nutrition.sugar !== undefined) {
      result.sugar = (result.sugar || 0) + nutrition.sugar * scale;
    }
    if (nutrition.sodium !== undefined) {
      result.sodium = (result.sodium || 0) + nutrition.sodium * scale;
    }
    if (nutrition.cholesterol !== undefined) {
      result.cholesterol = (result.cholesterol || 0) + nutrition.cholesterol * scale;
    }
  };

  // Add nutrition from own recipe
  if (ownNutrition) {
    Object.assign(result, ownNutrition);
  }

  // Recursively add nutrition from components
  const processComponents = (comps: ComponentWithHierarchy[]) => {
    for (const comp of comps) {
      // Add this component's nutrition scaled by servings needed
      addScaledNutrition(
        comp.childRecipe.nutrition,
        comp.childRecipe.servings,
        comp.servingsNeeded
      );

      // If the child has its own components, those are already included in its nutrition
      // so we don't recursively add them again (they're part of the child's total)
    }
  };

  processComponents(components);

  // Return undefined if no nutrition data
  if (Object.keys(result).length === 0) return undefined;

  // Round values to 1 decimal place
  for (const key of Object.keys(result) as (keyof NutritionInfo)[]) {
    if (result[key] !== undefined) {
      result[key] = Math.round(result[key]! * 10) / 10;
    }
  }

  return result;
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
   * List recipes with optional filtering and sorting
   */
  list: protectedProcedure
    .input(
      z
        .object({
          tags: z.array(z.string()).optional(),
          search: z.string().optional(),
          sortBy: z.enum([
            'title-asc',
            'title-desc',
            'date-newest',
            'date-oldest',
            'rating-high',
            'rating-low',
            'cooked-most',
            'cooked-least',
            'preptime-short',
            'preptime-long',
            'cooktime-short',
            'cooktime-long',
            'totaltime-short',
            'totaltime-long',
          ]).optional().default('date-newest'),
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

      // Apply sorting
      const sortBy = input?.sortBy || 'date-newest';
      allRecipes.sort((a, b) => {
        switch (sortBy) {
          case 'title-asc':
            return a.title.localeCompare(b.title);
          case 'title-desc':
            return b.title.localeCompare(a.title);
          case 'date-newest':
            return b.createdAt.getTime() - a.createdAt.getTime();
          case 'date-oldest':
            return a.createdAt.getTime() - b.createdAt.getTime();
          case 'rating-high':
            return (b.rating || 0) - (a.rating || 0);
          case 'rating-low':
            return (a.rating || 0) - (b.rating || 0);
          case 'cooked-most':
            return b.timesCooked - a.timesCooked;
          case 'cooked-least':
            return a.timesCooked - b.timesCooked;
          case 'preptime-short':
            return (a.prepTime || 9999) - (b.prepTime || 9999);
          case 'preptime-long':
            return (b.prepTime || 0) - (a.prepTime || 0);
          case 'cooktime-short':
            return (a.cookTime || 9999) - (b.cookTime || 9999);
          case 'cooktime-long':
            return (b.cookTime || 0) - (a.cookTime || 0);
          case 'totaltime-short':
            return (a.totalTime || 9999) - (b.totalTime || 9999);
          case 'totaltime-long':
            return (b.totalTime || 0) - (a.totalTime || 0);
          default:
            return 0;
        }
      });

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
   * Get related recipes based on shared tags
   */
  getRelated: protectedProcedure
    .input(z.object({
      id: z.string(),
      limit: z.number().min(1).max(20).optional().default(6),
    }))
    .query(async ({ input }) => {
      // Get the current recipe's tags
      const currentRecipeTags = await getRecipeTags(input.id);
      const currentTagIds = currentRecipeTags.map(t => t.id);

      if (currentTagIds.length === 0) {
        return [];
      }

      // Find recipes with matching tags (excluding the current recipe)
      const relatedRecipes = await db
        .select({
          recipeId: recipeTags.recipeId,
          matchCount: sql<number>`count(*)`,
        })
        .from(recipeTags)
        .where(inArray(recipeTags.tagId, currentTagIds))
        .groupBy(recipeTags.recipeId)
        .orderBy(sql`count(*) DESC`)
        .limit(input.limit + 1); // Get one extra to account for filtering out current recipe

      // Filter out the current recipe and get full recipe details
      const recipeIds = relatedRecipes
        .filter(r => r.recipeId !== input.id)
        .map(r => r.recipeId)
        .slice(0, input.limit);

      if (recipeIds.length === 0) {
        return [];
      }

      const relatedRecipesList = await db
        .select()
        .from(recipes)
        .where(inArray(recipes.id, recipeIds));

      // Get tags for each recipe
      const recipesWithTags = await Promise.all(
        relatedRecipesList.map(async (recipe) => ({
          ...recipe,
          tags: await getRecipeTags(recipe.id),
        }))
      );

      // Sort by number of matching tags (maintain the order from the query)
      const orderedRecipes = recipeIds
        .map(id => recipesWithTags.find(r => r.id === id))
        .filter((r): r is NonNullable<typeof r> => r !== undefined);

      return orderedRecipes;
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
   * Toggle favorite status
   */
  toggleFavorite: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
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

      const [updated] = await db
        .update(recipes)
        .set({ isFavorite: !recipe.isFavorite })
        .where(eq(recipes.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Update recipe rating and notes
   */
  updateRating: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        rating: z.number().min(1).max(5).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(recipes)
        .set({
          rating: input.rating,
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recipe not found',
        });
      }

      return updated;
    }),

  /**
   * Save AI-generated improvement ideas for a recipe
   */
  saveImprovementIdeas: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        improvementIdeas: z.array(
          z.object({
            category: z.string(),
            suggestion: z.string(),
            explanation: z.string(),
            priority: z.enum(['high', 'medium', 'low']),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(recipes)
        .set({
          improvementIdeas: input.improvementIdeas,
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recipe not found',
        });
      }

      return updated;
    }),

  /**
   * Mark recipe as cooked (increment counter and update timestamp)
   */
  markAsCooked: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
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

      const [updated] = await db
        .update(recipes)
        .set({
          timesCooked: recipe.timesCooked + 1,
          lastCookedAt: new Date(),
        })
        .where(eq(recipes.id, input.id))
        .returning();

      return updated;
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
        // Validate URL to prevent SSRF attacks
        const urlCheck = isAllowedUrl(input.url);
        if (!urlCheck.allowed) {
          throw new Error(urlCheck.reason || 'URL not allowed');
        }

        // Fetch the page with timeout and redirect limits
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(input.url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'RecipeManager/1.0 (Recipe Import Bot)',
          },
        });

        clearTimeout(timeout);

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
          recipeData.instructions = cleanRecipeInstructions(recipeData.instructions, true);
        } else {
          // Still clean up fractions and formatting even if not converting
          recipeData.instructions = cleanRecipeInstructions(recipeData.instructions, false);
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

  // ========== Component Management Endpoints ==========

  /**
   * Get components for a recipe (flat list, one level)
   */
  getComponents: protectedProcedure
    .input(z.object({ recipeId: z.string() }))
    .query(async ({ input }) => {
      const components = await getRecipeComponents(input.recipeId);

      // Get tags for each child recipe
      const componentsWithTags = await Promise.all(
        components.map(async (comp) => ({
          ...comp,
          childRecipe: {
            ...comp.childRecipe,
            tags: await getRecipeTags(comp.childRecipeId),
          },
        }))
      );

      return componentsWithTags;
    }),

  /**
   * Get full component hierarchy (recursively nested)
   */
  getHierarchy: protectedProcedure
    .input(z.object({ recipeId: z.string() }))
    .query(async ({ input }) => {
      return getRecipeHierarchy(input.recipeId);
    }),

  /**
   * Get aggregated nutrition for a compound recipe
   */
  getAggregatedNutrition: protectedProcedure
    .input(z.object({ recipeId: z.string() }))
    .query(async ({ input }) => {
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.recipeId))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recipe not found',
        });
      }

      const hierarchy = await getRecipeHierarchy(input.recipeId);

      if (hierarchy.length === 0) {
        // Not a compound recipe, return own nutrition
        return recipe.nutrition;
      }

      return aggregateNutrition(hierarchy, recipe.nutrition);
    }),

  /**
   * Add a component (child recipe) to a parent recipe
   */
  addComponent: protectedProcedure
    .input(
      z.object({
        parentRecipeId: z.string(),
        childRecipeId: z.string(),
        servingsNeeded: z.number().min(0.1).default(1),
      })
    )
    .mutation(async ({ input }) => {
      // Check parent recipe exists
      const [parent] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.parentRecipeId))
        .limit(1);

      if (!parent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Parent recipe not found',
        });
      }

      // Check child recipe exists
      const [child] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.childRecipeId))
        .limit(1);

      if (!child) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Child recipe not found',
        });
      }

      // Check for circular reference
      if (await wouldCreateCircularReference(input.parentRecipeId, input.childRecipeId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot add this recipe: it would create a circular reference',
        });
      }

      // Check if already exists
      const [existing] = await db
        .select()
        .from(recipeComponents)
        .where(
          and(
            eq(recipeComponents.parentRecipeId, input.parentRecipeId),
            eq(recipeComponents.childRecipeId, input.childRecipeId)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This recipe is already a component',
        });
      }

      // Get current max sort order
      const existingComponents = await db
        .select({ sortOrder: recipeComponents.sortOrder })
        .from(recipeComponents)
        .where(eq(recipeComponents.parentRecipeId, input.parentRecipeId))
        .orderBy(sql`${recipeComponents.sortOrder} DESC`)
        .limit(1);

      const nextSortOrder = existingComponents.length > 0
        ? existingComponents[0].sortOrder + 1
        : 0;

      // Insert component
      const [newComponent] = await db
        .insert(recipeComponents)
        .values({
          parentRecipeId: input.parentRecipeId,
          childRecipeId: input.childRecipeId,
          servingsNeeded: input.servingsNeeded,
          sortOrder: nextSortOrder,
        })
        .returning();

      return {
        ...newComponent,
        childRecipe: child,
      };
    }),

  /**
   * Update a component (change servings or sort order)
   */
  updateComponent: protectedProcedure
    .input(
      z.object({
        componentId: z.string(),
        servingsNeeded: z.number().min(0.1).optional(),
        sortOrder: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { componentId, ...updateData } = input;

      // Filter out undefined values
      const updates: Record<string, any> = {};
      if (updateData.servingsNeeded !== undefined) {
        updates.servingsNeeded = updateData.servingsNeeded;
      }
      if (updateData.sortOrder !== undefined) {
        updates.sortOrder = updateData.sortOrder;
      }

      if (Object.keys(updates).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No updates provided',
        });
      }

      const [updated] = await db
        .update(recipeComponents)
        .set(updates)
        .where(eq(recipeComponents.id, componentId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Component not found',
        });
      }

      return updated;
    }),

  /**
   * Remove a component from a recipe
   */
  removeComponent: protectedProcedure
    .input(z.object({ componentId: z.string() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .delete(recipeComponents)
        .where(eq(recipeComponents.id, input.componentId))
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Component not found',
        });
      }

      return { success: true };
    }),

  /**
   * Bulk update components for a recipe (used when saving from recipe form)
   */
  setComponents: protectedProcedure
    .input(
      z.object({
        recipeId: z.string(),
        components: z.array(
          z.object({
            childRecipeId: z.string(),
            servingsNeeded: z.number().min(0.1),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      // Check recipe exists
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.recipeId))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recipe not found',
        });
      }

      // Check for circular references
      for (const comp of input.components) {
        if (await wouldCreateCircularReference(input.recipeId, comp.childRecipeId)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot add recipe: it would create a circular reference`,
          });
        }
      }

      // Delete all existing components
      await db
        .delete(recipeComponents)
        .where(eq(recipeComponents.parentRecipeId, input.recipeId));

      // Insert new components
      if (input.components.length > 0) {
        await db.insert(recipeComponents).values(
          input.components.map((comp, index) => ({
            parentRecipeId: input.recipeId,
            childRecipeId: comp.childRecipeId,
            servingsNeeded: comp.servingsNeeded,
            sortOrder: index,
          }))
        );
      }

      return { success: true };
    }),
});
