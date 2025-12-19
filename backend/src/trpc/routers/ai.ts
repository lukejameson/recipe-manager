import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { aiService } from '../../services/ai/index.js';
import { calculateNutrition } from '../../services/ai/nutrition.js';

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
});
