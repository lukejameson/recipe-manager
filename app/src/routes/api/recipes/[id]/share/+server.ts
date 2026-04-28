import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  const array = new Uint8Array(21);
  crypto.getRandomValues(array);
  for (let i = 0; i < 21; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

export const POST: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!params.id) {
      throw error(400, 'Recipe ID is required');
    }

    const [existing] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.userId, user.userId)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Recipe not found');
    }

    let shareToken = existing.shareToken;
    const isShared = existing.isShared;

    if (!isShared || !shareToken) {
      shareToken = generateShareToken();
      await db
        .update(recipes)
        .set({ shareToken, isShared: true, updatedAt: new Date() })
        .where(eq(recipes.id, params.id));
    }

    return json({
      shareToken,
      isShared: true,
      shareUrl: `/share/${shareToken}`,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Share recipe error:', e);
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

    if (!params.id) {
      throw error(400, 'Recipe ID is required');
    }

    const [existing] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.userId, user.userId)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Recipe not found');
    }

    await db
      .update(recipes)
      .set({ shareToken: null, isShared: false, updatedAt: new Date() })
      .where(eq(recipes.id, params.id));

    return json({ success: true, isShared: false });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Revoke share error:', e);
    throw error(500, 'Internal server error');
  }
};

export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!params.id) {
      throw error(400, 'Recipe ID is required');
    }

    const [existing] = await db
      .select({ shareToken: recipes.shareToken, isShared: recipes.isShared })
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.userId, user.userId)))
      .limit(1);

    if (!existing) {
      throw error(404, 'Recipe not found');
    }

    return json({
      shareToken: existing.shareToken,
      isShared: existing.isShared,
      shareUrl: existing.isShared && existing.shareToken ? `/share/${existing.shareToken}` : null,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get share status error:', e);
    throw error(500, 'Internal server error');
  }
};