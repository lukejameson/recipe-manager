import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { tags, recipeTags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const mergeTagsSchema = z.object({
  sourceTagId: z.string(),
  targetTagId: z.string(),
});

// POST /api/tags/merge - Merge one tag into another
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = mergeTagsSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { sourceTagId, targetTagId } = result.data;

    if (sourceTagId === targetTagId) {
      throw error(400, 'Cannot merge a tag into itself');
    }

    // Verify both tags exist and belong to user
    const [sourceTag, targetTag] = await Promise.all([
      db.select().from(tags).where(and(eq(tags.id, sourceTagId), eq(tags.userId, user.userId))).limit(1),
      db.select().from(tags).where(and(eq(tags.id, targetTagId), eq(tags.userId, user.userId))).limit(1),
    ]);

    if (sourceTag.length === 0 || targetTag.length === 0) {
      throw error(404, 'One or both tags not found');
    }

    // Get all recipes with the source tag
    const sourceRecipes = await db
      .select({ recipeId: recipeTags.recipeId })
      .from(recipeTags)
      .where(eq(recipeTags.tagId, sourceTagId));

    // Get recipes that already have the target tag
    const targetRecipes = await db
      .select({ recipeId: recipeTags.recipeId })
      .from(recipeTags)
      .where(eq(recipeTags.tagId, targetTagId));

    const targetRecipeIds = new Set(targetRecipes.map(r => r.recipeId));

    // Move source tag recipes to target tag (only if not already tagged)
    const recipesToMove = sourceRecipes
      .map(r => r.recipeId)
      .filter(id => !targetRecipeIds.has(id));

    for (const recipeId of recipesToMove) {
      await db.insert(recipeTags).values({
        recipeId,
        tagId: targetTagId,
      });
    }

    // Delete the source tag and its associations
    await db.delete(recipeTags).where(eq(recipeTags.tagId, sourceTagId));
    await db.delete(tags).where(eq(tags.id, sourceTagId));

    return json({
      success: true,
      deletedCount: 1,
      deletedTags: [sourceTag[0].name],
      movedRecipes: recipesToMove.length,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Merge tags error:', e);
    throw error(500, 'Internal server error');
  }
};