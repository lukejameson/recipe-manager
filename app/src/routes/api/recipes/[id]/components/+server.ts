import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, recipeComponents } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const componentsSchema = z.object({
  components: z.array(z.object({
    childRecipeId: z.string(),
    servingsNeeded: z.coerce.number().min(0.1).default(1),
    sortOrder: z.coerce.number().default(0),
  })),
});

/**
 * GET /api/recipes/[id]/components - Get recipe components
 */
export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Check recipe exists and belongs to user
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.userId, user.userId)))
      .limit(1);

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    // Get components
    const components = await db
      .select({
        id: recipeComponents.id,
        childRecipeId: recipeComponents.childRecipeId,
        servingsNeeded: recipeComponents.servingsNeeded,
        sortOrder: recipeComponents.sortOrder,
        childRecipe: {
          id: recipes.id,
          title: recipes.title,
          servings: recipes.servings,
        },
      })
      .from(recipeComponents)
      .innerJoin(recipes, eq(recipeComponents.childRecipeId, recipes.id))
      .where(eq(recipeComponents.parentRecipeId, params.id))
      .orderBy(recipeComponents.sortOrder);

    return json(components);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get components error:', e);
    throw error(500, 'Internal server error');
  }
};

/**
 * POST /api/recipes/[id]/components - Set recipe components
 */
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Check recipe exists and belongs to user
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.userId, user.userId)))
      .limit(1);

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    const body = await request.json();
    const result = componentsSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { components } = result.data;

    // Delete existing components
    await db.delete(recipeComponents).where(eq(recipeComponents.parentRecipeId, params.id));

    // Insert new components
    if (components.length > 0) {
      await db.insert(recipeComponents).values(
        components.map((comp, index) => ({
          parentRecipeId: params.id,
          childRecipeId: comp.childRecipeId,
          servingsNeeded: comp.servingsNeeded,
          sortOrder: comp.sortOrder ?? index,
        }))
      );
    }

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Set components error:', e);
    throw error(500, 'Internal server error');
  }
};
