import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipeCategories, recipeCategoryTags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const { id: categoryId, tagId } = params;
    if (!categoryId || !tagId) {
      throw error(400, 'Category ID and Tag ID are required');
    }

    const category = await db
      .select()
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.id, categoryId),
          eq(recipeCategories.userId, user.userId)
        )
      )
      .limit(1);

    if (category.length === 0) {
      throw error(404, 'Category not found');
    }

    await db
      .delete(recipeCategoryTags)
      .where(
        and(
          eq(recipeCategoryTags.categoryId, categoryId),
          eq(recipeCategoryTags.tagId, tagId)
        )
      );

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Remove tag from category error:', e);
    throw error(500, 'Internal server error');
  }
};
