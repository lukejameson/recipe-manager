import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipeCategories, recipeCategoryTags, tags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const { id: categoryId } = params;
    if (!categoryId) {
      throw error(400, 'Category ID is required');
    }

    const body = await request.json();
    const schema = z.object({
      tagIds: z.array(z.string()),
    });
    const result = schema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { tagIds } = result.data;

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

    if (tagIds.length > 0) {
      const validTags = await db
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            eq(tags.userId, user.userId),
            inArray(tags.id, tagIds)
          )
        );

      const validTagIdSet = new Set(validTags.map(t => t.id));
      const filteredTagIds = tagIds.filter(id => validTagIdSet.has(id));

      if (filteredTagIds.length > 0) {
        const associations = filteredTagIds.map(tagId => ({
          categoryId,
          tagId,
        }));
        await db.insert(recipeCategoryTags).values(associations).onConflictDoNothing();
      }
    }

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Add tags to category error:', e);
    throw error(500, 'Internal server error');
  }
};
