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

const protectedProcedure = t.procedure.use(isAuthenticated);

export const aiRouter = t.router({
  /**
   * Check if AI service is configured
   */
  isConfigured: protectedProcedure.query(async () => {
    const initialized = await aiService.initialize();
    return { configured: initialized };
  }),

  /**
   * Calculate nutrition for a recipe using AI
   */
  calculateNutrition: protectedProcedure
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
   */
  suggestTags: protectedProcedure
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
   */
  explainTechnique: protectedProcedure
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
   */
  suggestSubstitutions: protectedProcedure
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
   */
  suggestImprovements: protectedProcedure
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
   */
  applyImprovements: protectedProcedure
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
   */
  adaptRecipe: protectedProcedure
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
   */
  findMatchingRecipes: protectedProcedure
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
   */
  recipeChat: protectedProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
          })
        ).min(1),
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
        return await chatAboutRecipes(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to chat about recipes',
        });
      }
    }),

  /**
   * Chat about a specific recipe - ask questions, get suggestions, etc.
   */
  chatAboutRecipe: protectedProcedure
    .input(
      z.object({
        recipe: z.object({
          title: z.string(),
          description: z.string().optional(),
          ingredients: z.array(z.string()),
          instructions: z.array(z.string()),
          prepTime: z.number().optional(),
          cookTime: z.number().optional(),
          servings: z.number().optional(),
          tags: z.array(z.string()).optional(),
        }),
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
          })
        ).min(1),
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
        return await chatAboutSpecificRecipe(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to chat about recipe',
        });
      }
    }),
});
