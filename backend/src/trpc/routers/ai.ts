import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { aiService } from '../../services/ai/index.js';
import { calculateNutrition } from '../../services/ai/nutrition.js';
import { suggestTags } from '../../services/ai/auto-tagging.js';
import { explainTechnique } from '../../services/ai/techniques.js';
import { suggestSubstitutions } from '../../services/ai/substitution.js';
import { suggestImprovements, applyImprovements } from '../../services/ai/improvement.js';
import { adaptRecipe, type AdaptationType } from '../../services/ai/adaptation.js';
import { findMatchingRecipes } from '../../services/ai/pantry-match.js';
import { chatAboutRecipes, chatAboutSpecificRecipe } from '../../services/ai/recipe-chat.js';
import { db } from '../../db/index.js';
import { users, memories, recipes, tags, recipeTags, DEFAULT_FEATURE_FLAGS, type UserFeatureFlags } from '../../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

const t = initTRPC.context<Context>().create();

// Auth middleware
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }
  return next({ ctx: { userId: ctx.userId } });
});

// Feature flag middleware factory
const requireFeature = (feature: keyof UserFeatureFlags) => {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in',
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
    });

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not found',
      });
    }

    const featureFlags = user.featureFlags ?? DEFAULT_FEATURE_FLAGS;

    if (!featureFlags[feature]) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `This feature (${feature}) is not enabled for your account. Contact an administrator.`,
      });
    }

    return next({ ctx: { userId: ctx.userId } });
  });
};

const protectedProcedure = t.procedure.use(isAuthenticated);

// Feature-gated procedures
const aiChatProcedure = t.procedure.use(requireFeature('aiChat'));
const nutritionProcedure = t.procedure.use(requireFeature('nutritionCalc'));
const tagSuggestionProcedure = t.procedure.use(requireFeature('tagSuggestions'));

export const aiRouter = t.router({
  /**
   * Check if AI service is configured
   */
  isConfigured: protectedProcedure.query(async () => {
    const initialized = await aiService.initialize();
    return { configured: initialized };
  }),

  /**
   * Get user's feature flags for AI features
   */
  getFeatureFlags: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
    });

    const featureFlags = user?.featureFlags ?? DEFAULT_FEATURE_FLAGS;

    return {
      aiChat: featureFlags.aiChat,
      recipeGeneration: featureFlags.recipeGeneration,
      tagSuggestions: featureFlags.tagSuggestions,
      nutritionCalc: featureFlags.nutritionCalc,
      photoExtraction: featureFlags.photoExtraction,
      urlImport: featureFlags.urlImport,
      imageSearch: featureFlags.imageSearch,
    };
  }),

  /**
   * Calculate nutrition for a recipe using AI
   * Requires: nutritionCalc feature
   */
  calculateNutrition: nutritionProcedure
    .input(
      z.object({
        ingredients: z.array(z.string()).min(1, 'At least one ingredient is required'),
        servings: z.number().min(1, 'Servings must be at least 1'),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Initialize AI service (loads API key from database)
      const initialized = await aiService.initialize();

      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }

      try {
        const nutrition = await calculateNutrition(input);
        return nutrition;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to calculate nutrition',
        });
      }
    }),

  /**
   * Suggest tags for a recipe using AI
   * Requires: tagSuggestions feature
   */
  suggestTags: tagSuggestionProcedure
    .input(
      z.object({
        recipe: z.object({
          title: z.string(),
          description: z.string().optional(),
          ingredients: z.array(z.string()),
          instructions: z.array(z.string()),
        }),
        existingTags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }
      try {
        return await suggestTags(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to suggest tags',
        });
      }
    }),

  /**
   * Explain a cooking technique or term
   * Requires: aiChat feature
   */
  explainTechnique: aiChatProcedure
    .input(
      z.object({
        term: z.string().min(1).max(100),
        context: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }
      try {
        return await explainTechnique(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to explain technique',
        });
      }
    }),

  /**
   * Suggest ingredient substitutions
   * Requires: aiChat feature
   */
  suggestSubstitutions: aiChatProcedure
    .input(
      z.object({
        ingredient: z.string().min(1).max(200),
        context: z.string().max(500).optional(),
        dietaryRestrictions: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }
      try {
        return await suggestSubstitutions(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to suggest substitutions',
        });
      }
    }),

  /**
   * Suggest improvements for a recipe
   * Requires: aiChat feature
   */
  suggestImprovements: aiChatProcedure
    .input(
      z.object({
        recipe: z.object({
          title: z.string(),
          description: z.string().optional(),
          ingredients: z.array(z.string()),
          instructions: z.array(z.string()),
          prepTime: z.number().optional(),
          cookTime: z.number().optional(),
        }),
        focusAreas: z
          .array(z.enum(['flavor', 'technique', 'presentation', 'efficiency']))
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }
      try {
        return await suggestImprovements(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to suggest improvements',
        });
      }
    }),

  /**
   * Apply selected improvements to a recipe
   * Requires: aiChat feature
   */
  applyImprovements: aiChatProcedure
    .input(
      z.object({
        recipe: z.object({
          title: z.string(),
          ingredients: z.array(z.string()),
          instructions: z.array(z.string()),
        }),
        improvements: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ input }) => {
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }
      try {
        return await applyImprovements(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to apply improvements',
        });
      }
    }),

  /**
   * Adapt a recipe for dietary requirements
   * Requires: aiChat feature
   */
  adaptRecipe: aiChatProcedure
    .input(
      z.object({
        recipe: z.object({
          title: z.string(),
          ingredients: z.array(z.string()),
          instructions: z.array(z.string()),
        }),
        adaptationType: z.enum([
          'vegan',
          'vegetarian',
          'gluten-free',
          'dairy-free',
          'low-carb',
          'keto',
          'nut-free',
          'low-sodium',
        ]),
      })
    )
    .mutation(async ({ input }) => {
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }
      try {
        return await adaptRecipe(input as { recipe: typeof input.recipe; adaptationType: AdaptationType });
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to adapt recipe',
        });
      }
    }),

  /**
   * Find recipes matching available ingredients
   * Requires: aiChat feature
   */
  findMatchingRecipes: aiChatProcedure
    .input(
      z.object({
        availableIngredients: z.array(z.string()).min(1),
        recipes: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            ingredients: z.array(z.string()),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }
      try {
        return await findMatchingRecipes(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to find matching recipes',
        });
      }
    }),

  /**
   * Chat about recipes - brainstorm ideas and generate new recipes
   * Requires: aiChat feature
   * Supports @ mentioning existing recipes for context
   */
  recipeChat: aiChatProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
            images: z.array(z.string()).max(5).optional(),
          })
        ).min(1),
        agentId: z.string().optional(),
        referencedRecipes: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().nullish(),
            ingredients: z.array(z.string()),
            instructions: z.array(z.string()),
            prepTime: z.number().nullish(),
            cookTime: z.number().nullish(),
            servings: z.number().nullish(),
          })
        ).max(5).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }
      try {
        return await chatAboutRecipes(input, ctx.userId, input.agentId, input.referencedRecipes);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to chat about recipes',
        });
      }
    }),

  /**
   * Chat about a specific recipe - ask questions, get suggestions, etc.
   * Requires: aiChat feature
   */
  chatAboutRecipe: aiChatProcedure
    .input(
      z.object({
        recipe: z.object({
          title: z.string(),
          description: z.string().nullish(),
          ingredients: z.array(z.string()),
          instructions: z.array(z.string()),
          prepTime: z.number().nullish(),
          cookTime: z.number().nullish(),
          servings: z.number().nullish(),
          tags: z.array(z.string()).nullish(),
        }),
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
            images: z.array(z.string()).max(5).optional(),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI service not configured. Please add your Anthropic API key in Settings.',
        });
      }
      try {
        const result = await chatAboutSpecificRecipe(input, ctx.userId);
        return {
          message: result.message,
          recipe: result.recipe,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to chat about recipe',
        });
      }
    }),

  /**
   * Search user's recipes by title for @ mentions in chat
   * Returns simplified recipe data for context
   */
  searchRecipesForMention: aiChatProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(10).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const userRecipes = await db
        .select({
          id: recipes.id,
          title: recipes.title,
          description: recipes.description,
          ingredients: recipes.ingredients,
          instructions: recipes.instructions,
          prepTime: recipes.prepTime,
          cookTime: recipes.cookTime,
          servings: recipes.servings,
        })
        .from(recipes)
        .where(
          and(
            eq(recipes.userId, ctx.userId),
            sql`LOWER(${recipes.title}) LIKE LOWER(${'%' + input.query + '%'})`
          )
        )
        .orderBy(recipes.title)
        .limit(input.limit);

      return userRecipes.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        ingredients: r.ingredients,
        instructions: r.instructions,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        servings: r.servings,
      }));
    }),

  /**
   * Get personalized recipe suggestions based on user preferences and existing recipes
   * No AI feature flag required - just fetches data and generates prompts
   */
  getPersonalizedSuggestions: protectedProcedure.query(async ({ ctx }) => {
    // Get user's preferences/memories
    const userMemories = await db
      .select()
      .from(memories)
      .where(and(eq(memories.userId, ctx.userId), eq(memories.enabled, true)));

    // Get user's most used tags (top 10)
    const popularTags = await db
      .select({
        name: tags.name,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(recipeTags)
      .innerJoin(tags, eq(recipeTags.tagId, tags.id))
      .innerJoin(recipes, eq(recipeTags.recipeId, recipes.id))
      .where(eq(recipes.userId, ctx.userId))
      .groupBy(tags.name)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get some recent recipe titles for inspiration
    const recentRecipes = await db
      .select({ title: recipes.title })
      .from(recipes)
      .where(eq(recipes.userId, ctx.userId))
      .orderBy(desc(recipes.createdAt))
      .limit(5);

    // Generate personalized suggestions based on the data
    const suggestions: string[] = [];
    const memoryTexts = userMemories.map(m => m.content.toLowerCase());

    // Add preference-based suggestions
    if (memoryTexts.some(m => m.includes('vegetarian'))) {
      suggestions.push("I'd like a vegetarian recipe idea");
    }
    if (memoryTexts.some(m => m.includes('vegan'))) {
      suggestions.push("Suggest a delicious vegan dish");
    }
    if (memoryTexts.some(m => m.includes('gluten') || m.includes('celiac'))) {
      suggestions.push("I need a gluten-free recipe");
    }
    if (memoryTexts.some(m => m.includes('low carb') || m.includes('keto'))) {
      suggestions.push("Give me a low-carb meal idea");
    }
    if (memoryTexts.some(m => m.includes('dairy'))) {
      suggestions.push("Suggest a dairy-free recipe");
    }

    // Add tag-based suggestions
    const tagNames = popularTags.map(t => t.name.toLowerCase());

    if (tagNames.includes('italian') || tagNames.includes('pasta')) {
      suggestions.push("I'm in the mood for Italian food");
    }
    if (tagNames.includes('asian') || tagNames.includes('chinese') || tagNames.includes('thai')) {
      suggestions.push("Suggest an Asian-inspired dish");
    }
    if (tagNames.includes('mexican') || tagNames.includes('tacos')) {
      suggestions.push("I'd love something with Mexican flavors");
    }
    if (tagNames.includes('indian') || tagNames.includes('curry')) {
      suggestions.push("Create a flavorful Indian recipe");
    }
    if (tagNames.includes('breakfast') || tagNames.includes('brunch')) {
      suggestions.push("I need a great breakfast idea");
    }
    if (tagNames.includes('dessert') || tagNames.includes('sweet')) {
      suggestions.push("Suggest a tasty dessert recipe");
    }
    if (tagNames.includes('soup') || tagNames.includes('stew')) {
      suggestions.push("I'd like a comforting soup recipe");
    }
    if (tagNames.includes('salad') || tagNames.includes('healthy')) {
      suggestions.push("Give me a healthy salad idea");
    }
    if (tagNames.includes('quick') || tagNames.includes('easy')) {
      suggestions.push("I need something quick and easy");
    }
    if (tagNames.includes('chicken')) {
      suggestions.push("Create a new chicken recipe for me");
    }
    if (tagNames.includes('seafood') || tagNames.includes('fish')) {
      suggestions.push("Suggest a seafood dish");
    }

    // If user has recipes, suggest something similar
    if (recentRecipes.length > 0) {
      const randomRecipe = recentRecipes[Math.floor(Math.random() * recentRecipes.length)];
      suggestions.push(`Something similar to my ${randomRecipe.title}`);
    }

    // Add some general suggestions if we don't have enough
    const defaultSuggestions = [
      "Surprise me with something new!",
      "What's good for a weeknight dinner?",
      "I want to try a new cuisine",
      "Suggest something with ingredients I probably have",
      "What's a crowd-pleasing dish?",
    ];

    // Fill in with defaults if needed, avoiding duplicates
    for (const suggestion of defaultSuggestions) {
      if (suggestions.length >= 5) break;
      if (!suggestions.includes(suggestion)) {
        suggestions.push(suggestion);
      }
    }

    // Shuffle and return top 5
    const shuffled = suggestions.sort(() => Math.random() - 0.5);
    return {
      suggestions: shuffled.slice(0, 5),
      hasPreferences: userMemories.length > 0,
      hasRecipes: recentRecipes.length > 0,
      topTags: popularTags.slice(0, 5).map(t => t.name),
    };
  }),
});
