import { initTRPC } from '@trpc/server';
import { Context } from './context.js';
import { authRouter } from './routers/auth.js';
import { recipeRouter } from './routers/recipe.js';
import { tagRouter } from './routers/tag.js';

const t = initTRPC.context<Context>().create();

/**
 * Main application router combining all sub-routers
 */
export const appRouter = t.router({
  auth: authRouter,
  recipe: recipeRouter,
  tag: tagRouter,
});

export type AppRouter = typeof appRouter;
