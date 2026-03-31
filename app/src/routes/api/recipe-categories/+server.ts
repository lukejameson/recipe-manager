import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipeCategories, recipeCategoryTags, tags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, asc, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { matchesPattern } from '$lib/utils/pattern';

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  iconName: z.string().optional().default(''),
  tagIds: z.array(z.string()).optional().default([]),
  tagPatterns: z.array(z.string()).optional().default([]),
});
const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  iconName: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  tagIds: z.array(z.string()).optional(),
  tagPatterns: z.array(z.string()).optional(),
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

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const categories = await db
      .select({
        id: recipeCategories.id,
        userId: recipeCategories.userId,
        name: recipeCategories.name,
        iconName: recipeCategories.iconName,
        sortOrder: recipeCategories.sortOrder,
        tagPatterns: recipeCategories.tagPatterns,
        isDefault: recipeCategories.isDefault,
        createdAt: recipeCategories.createdAt,
        updatedAt: recipeCategories.updatedAt,
      })
      .from(recipeCategories)
      .where(eq(recipeCategories.userId, user.userId))
      .orderBy(asc(recipeCategories.sortOrder));
    const categoryIds = categories.map(c => c.id);
    let tagsByCategoryId: Record<string, Array<{ id: string; name: string }>> = {};
    if (categoryIds.length > 0) {
      const categoryTagRows = await db
        .select({
          categoryId: recipeCategoryTags.categoryId,
          tagId: tags.id,
          tagName: tags.name,
        })
        .from(recipeCategoryTags)
        .innerJoin(tags, eq(recipeCategoryTags.tagId, tags.id))
        .where(inArray(recipeCategoryTags.categoryId, categoryIds));
      for (const row of categoryTagRows) {
        if (!tagsByCategoryId[row.categoryId]) {
          tagsByCategoryId[row.categoryId] = [];
        }
        tagsByCategoryId[row.categoryId].push({ id: row.tagId, name: row.tagName });
      }
    }
    const normalized = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      iconName: cat.iconName || null,
      sortOrder: cat.sortOrder,
      tagPatterns: cat.tagPatterns || [],
      isDefault: cat.isDefault || false,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      tags: (tagsByCategoryId[cat.id] || []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return json(normalized);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('List recipe categories error:', e);
    throw error(500, 'Internal server error');
  }
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = categorySchema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { name, iconName, tagIds, tagPatterns } = result.data;

    const existing = await db
      .select()
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.userId, user.userId),
          eq(recipeCategories.name, name)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw error(400, 'A category with this name already exists');
    }

    const maxOrder = await db
      .select({ max: sql<number>`MAX(${recipeCategories.sortOrder})` })
      .from(recipeCategories)
      .where(eq(recipeCategories.userId, user.userId))
      .then(res => res[0]?.max || 0);

    const [newCategory] = await db
      .insert(recipeCategories)
      .values({
        userId: user.userId,
        name,
        iconName: iconName || null,
        sortOrder: maxOrder + 1,
        tagPatterns: tagPatterns || [],
      })
      .returning();

    if (tagIds && tagIds.length > 0) {
      const validTagIds = await db
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            eq(tags.userId, user.userId),
            inArray(tags.id, tagIds)
          )
        );

      const validTagIdSet = new Set(validTagIds.map(t => t.id));
      const filteredTagIds = tagIds.filter(id => validTagIdSet.has(id));

      if (filteredTagIds.length > 0) {
        const associations = filteredTagIds.map(tagId => ({
          categoryId: newCategory.id,
          tagId,
        }));
        await db.insert(recipeCategoryTags).values(associations).onConflictDoNothing();
      }
    }

    await autoMatchCategoryPatterns(newCategory.id, tagPatterns || []);
    const createdWithTags = await db
      .select({
        id: recipeCategories.id,
        name: recipeCategories.name,
        iconName: recipeCategories.iconName,
        sortOrder: recipeCategories.sortOrder,
        tagPatterns: recipeCategories.tagPatterns,
        isDefault: recipeCategories.isDefault,
        tags: sql<Array<{ id: string; name: string }>>`
          (SELECT json_agg(t.*) FROM (
            SELECT t.id, t.name
            FROM tags t
            INNER JOIN recipe_category_tags rct ON t.id = rct.tag_id
            WHERE rct.category_id = ${newCategory.id}
            ORDER BY t.name
          ) AS t)
        `.as('tags'),
      })
      .from(recipeCategories)
      .where(eq(recipeCategories.id, newCategory.id))
      .limit(1);
    return json({
      id: createdWithTags[0].id,
      name: createdWithTags[0].name,
      iconName: createdWithTags[0].iconName,
      sortOrder: createdWithTags[0].sortOrder,
      tagPatterns: createdWithTags[0].tagPatterns || [],
      isDefault: createdWithTags[0].isDefault || false,
      tags: createdWithTags[0].tags || [],
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Create recipe category error:', e);
    throw error(500, 'Internal server error');
  }
};
