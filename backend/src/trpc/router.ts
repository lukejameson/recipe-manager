import { initTRPC } from '@trpc/server';
import { Context } from './context.js';
import { authRouter } from './routers/auth.js';
import { recipeRouter } from './routers/recipe.js';
import { tagRouter } from './routers/tag.js';
import { collectionRouter } from './routers/collection.js';
import { shoppingListRouter } from './routers/shopping-list.js';
import { settingsRouter } from './routers/settings.js';
import { aiRouter } from './routers/ai.js';
import { agentsRouter } from './routers/agents.js';
import { adminRouter } from './routers/admin.js';
import { chatHistoryRouter } from './routers/chat-history.js';

const t = initTRPC.context<Context>().create();

/**
 * Main application router combining all sub-routers
 */
export const appRouter = t.router({
  auth: authRouter,
  recipe: recipeRouter,
  tag: tagRouter,
  collection: collectionRouter,
  shoppingList: shoppingListRouter,
  settings: settingsRouter,
  ai: aiRouter,
  agents: agentsRouter,
  admin: adminRouter,
  chatHistory: chatHistoryRouter,
});

export type AppRouter = typeof appRouter;
