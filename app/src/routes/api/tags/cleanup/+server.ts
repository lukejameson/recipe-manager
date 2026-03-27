import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { tags, recipeTags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, not, inArray } from 'drizzle-orm';

// POST /api/tags/cleanup - Remove orphaned tags (tags with no recipes)
export const POST: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Find all tags that have no associated recipes
    const allTags = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.userId, user.userId));

    const tagIds = allTags.map(t => t.id);

    if (tagIds.length === 0) {
      return json({
        success: true,
        deletedCount: 0,
        deletedTags: [],
      });
    }

    // Get tags that have recipes
    const usedTags = await db
      .select({ tagId: recipeTags.tagId })
      .from(recipeTags)
      .where(inArray(recipeTags.tagId, tagIds));

    const usedTagIds = new Set(usedTags.map(t => t.tagId));

    // Find orphaned tags
    const orphanedTags = allTags.filter(t => !usedTagIds.has(t.id));

    if (orphanedTags.length === 0) {
      return json({
        success: true,
        deletedCount: 0,
        deletedTags: [],
      });
    }

    // Delete orphaned tags
    const orphanedTagIds = orphanedTags.map(t => t.id);
    await db.delete(tags).where(inArray(tags.id, orphanedTagIds));

    return json({
      success: true,
      deletedCount: orphanedTags.length,
      deletedTags: orphanedTags.map(t => t.name),
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Cleanup tags error:', e);
    throw error(500, 'Internal server error');
  }
};