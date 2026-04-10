import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipeCategories, recipeCategoryTags, tags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, sql, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { matchesPattern } from '$lib/utils/pattern';

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  iconName: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  tagIds: z.array(z.string()).optional(),
  tagPatterns: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

async function autoMatchCategoryPatterns(categoryId: string, patterns: string[]) {
  if (!patterns || patterns.length === 0) return;
  const allTags = await db
    .select()
    .from(tags);
  const matchingTags = allTags.filter(tag =>
    patterns.some(pattern => matchesPattern(tag.name, pattern))
  );
  if (matchingTags.length > 0) {
    const existingLinks = await db
      .select({ tagId: recipeCategoryTags.tagId })
      .from(recipeCategoryTags)
      .where(eq(recipeCategoryTags.categoryId, categoryId));
    const existingTagIds = new Set(existingLinks.map(l => l.tagId));
    const newLinks = matchingTags
      .filter(tag => !existingTagIds.has(tag.id))
      .map(tag => ({ categoryId, tagId: tag.id }));
    if (newLinks.length > 0) {
      await db.insert(recipeCategoryTags).values(newLinks).onConflictDoNothing();
    }
  }
}

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const { id } = params;
    if (!id) {
      throw error(400, 'Category ID is required');
    }

    const body = await request.json();
    const result = updateCategorySchema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const updates: any = {};
    if (result.data.name !== undefined) updates.name = result.data.name;
    if (result.data.iconName !== undefined) updates.iconName = result.data.iconName;
    if (result.data.sortOrder !== undefined) updates.sortOrder = result.data.sortOrder;
    if (result.data.tagPatterns !== undefined) updates.tagPatterns = result.data.tagPatterns;
    if (result.data.isDefault !== undefined) updates.isDefault = result.data.isDefault;
    updates.updatedAt = new Date();
    const existing = await db
      .select()
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.id, id),
          eq(recipeCategories.userId, user.userId)
        )
      )
      .limit(1);
    if (existing.length === 0) {
      throw error(404, 'Category not found');
    }
    if (result.data.isDefault === true) {
      await db
        .update(recipeCategories)
        .set({ isDefault: false })
        .where(
          and(
            eq(recipeCategories.userId, user.userId),
            ne(recipeCategories.id, id)
          )
        );
    }

    const existing = await db
      .select()
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.id, id),
          eq(recipeCategories.userId, user.userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      throw error(404, 'Category not found');
    }

    if (result.data.name && result.data.name !== existing[0].name) {
      const duplicate = await db
        .select()
        .from(recipeCategories)
        .where(
          and(
            eq(recipeCategories.userId, user.userId),
            eq(recipeCategories.name, result.data.name)
          )
        )
        .limit(1);

      if (duplicate.length > 0) {
        throw error(400, 'A category with this name already exists');
      }
    }

    if (result.data.tagIds !== undefined) {
      await db
        .delete(recipeCategoryTags)
        .where(eq(recipeCategoryTags.categoryId, id));

      const { tagIds } = result.data;
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

        const validTagIds = new Set(validTags.map(t => t.id));
        const filteredTagIds = tagIds.filter(id => validTagIds.has(id));

        if (filteredTagIds.length > 0) {
          const associations = filteredTagIds.map(tagId => ({
            categoryId: id,
            tagId,
          }));
          await db.insert(recipeCategoryTags).values(associations).onConflictDoNothing();
        }
      }
    }

    if (result.data.tagPatterns !== undefined) {
      await autoMatchCategoryPatterns(id, result.data.tagPatterns);
    }

    await db
      .update(recipeCategories)
      .set(updates)
      .where(eq(recipeCategories.id, id));
    const updated = await db
      .select({
        id: recipeCategories.id,
        name: recipeCategories.name,
        iconName: recipeCategories.iconName,
        sortOrder: recipeCategories.sortOrder,
        tagPatterns: recipeCategories.tagPatterns,
        isDefault: recipeCategories.isDefault,
      })
      .from(recipeCategories)
      .where(eq(recipeCategories.id, id))
      .limit(1);
    const categoryTagRows = await db
      .select({
        tagId: tags.id,
        tagName: tags.name,
      })
      .from(recipeCategoryTags)
      .innerJoin(tags, eq(recipeCategoryTags.tagId, tags.id))
      .where(eq(recipeCategoryTags.categoryId, id));
    const categoryTags = categoryTagRows
      .map(row => ({ id: row.tagId, name: row.tagName }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json({
      id: updated[0].id,
      name: updated[0].name,
      iconName: updated[0].iconName,
      sortOrder: updated[0].sortOrder,
      tagPatterns: updated[0].tagPatterns || [],
      isDefault: updated[0].isDefault || false,
      tags: categoryTags,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update recipe category error:', e);
    throw error(500, 'Internal server error');
  }
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const { id } = params;
    if (!id) {
      throw error(400, 'Category ID is required');
    }

    const result = await db
      .delete(recipeCategories)
      .where(
        and(
          eq(recipeCategories.id, id),
          eq(recipeCategories.userId, user.userId)
        )
      )
      .returning();

    if (result.length === 0) {
      throw error(404, 'Category not found');
    }

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete recipe category error:', e);
    throw error(500, 'Internal server error');
  }
};
