import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { collections, collectionRecipes, recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/collections/[id] - Get a specific collection with recipes
export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const [collection] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, params.id), eq(collections.userId, user.userId)))
      .limit(1);

    if (!collection) {
      throw error(404, 'Collection not found');
    }

    // Get recipes in this collection
    const collectionRecipesData = await db
      .select({
        recipe: recipes,
        addedAt: collectionRecipes.addedAt,
      })
      .from(collectionRecipes)
      .innerJoin(recipes, eq(collectionRecipes.recipeId, recipes.id))
      .where(and(
        eq(collectionRecipes.collectionId, params.id),
        eq(recipes.userId, user.userId)
      ));

    return json({
      ...collection,
      recipes: collectionRecipesData.map((cr) => ({
        ...cr.recipe,
        addedAt: cr.addedAt,
      })),
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get collection error:', e);
    throw error(500, 'Internal server error');
  }
};

// PUT /api/collections/[id] - Update a collection
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
    });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, params.id), eq(collections.userId, user.userId)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Collection not found');
    }

    const [updated] = await db
      .update(collections)
      .set(result.data)
      .where(eq(collections.id, params.id))
      .returning();

    return json(updated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update collection error:', e);
    throw error(500, 'Internal server error');
  }
};

// DELETE /api/collections/[id] - Delete a collection
export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, params.id), eq(collections.userId, user.userId)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Collection not found');
    }

    await db.delete(collections).where(eq(collections.id, params.id));
    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete collection error:', e);
    throw error(500, 'Internal server error');
  }
};
