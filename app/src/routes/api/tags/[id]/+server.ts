import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { tags, recipeTags } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

// PUT /api/tags/[id] - Update a tag
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({ name: z.string().min(1).max(50) });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { name } = result.data;

    // Check if tag exists and belongs to user
    const [existing] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, params.id), eq(tags.userId, user.userId)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Tag not found');
    }

    // Check if new name already exists
    const [duplicate] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.name, name), eq(tags.userId, user.userId)))
      .limit(1);

    if (duplicate && duplicate.id !== params.id) {
      throw error(409, 'A tag with this name already exists');
    }

    const [updated] = await db
      .update(tags)
      .set({ name })
      .where(eq(tags.id, params.id))
      .returning();

    return json(updated);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update tag error:', e);
    throw error(500, 'Internal server error');
  }
};

// DELETE /api/tags/[id] - Delete a tag
export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Check ownership
    const [tag] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, params.id), eq(tags.userId, user.userId)))
      .limit(1);

    if (!tag) {
      throw error(404, 'Tag not found');
    }

    // Check if any recipes use this tag
    const recipesWithTag = await db
      .select()
      .from(recipeTags)
      .where(eq(recipeTags.tagId, params.id))
      .limit(1);

    if (recipesWithTag.length > 0) {
      throw error(400, 'Cannot delete tag that is in use by recipes');
    }

    await db.delete(tags).where(eq(tags.id, params.id));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete tag error:', e);
    throw error(500, 'Internal server error');
  }
};
