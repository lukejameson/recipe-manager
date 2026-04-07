import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { db } from '$lib/server/db/db';
import { recipes } from '$lib/server/db/schema';
import { isNotNull, and, eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!user.isAdmin) {
      throw error(403, 'Admin access required');
    }

    const recipeId = url.searchParams.get('recipeId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = db.select({
      id: recipes.id,
      title: recipes.title,
      imageUrl: recipes.imageUrl
    }).from(recipes)
      .where(and(
        isNotNull(recipes.imageUrl),
        eq(recipes.userId, user.userId)
      ))
      .limit(limit)
      .offset(offset);

    if (recipeId) {
      query = db.select({
        id: recipes.id,
        title: recipes.title,
        imageUrl: recipes.imageUrl
      }).from(recipes)
        .where(and(
          eq(recipes.id, recipeId),
          isNotNull(recipes.imageUrl),
          eq(recipes.userId, user.userId)
        ))
        .limit(1) as any;
    }

    const results = await query;

    return json({
      recipes: results,
      hasMore: results.length === limit
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get migration list error:', e);
    throw error(500, 'Internal server error');
  }
};
