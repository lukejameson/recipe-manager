import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { db } from '$lib/server/db/db';
import { photos, recipePhotos, recipes } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { photoCache } from '$lib/server/cache/photo-cache';

const addPhotoSchema = z.object({
  photoId: z.string().uuid()
});

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const body = await request.json();
    const result = addPhotoSchema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }
    const { photoId } = result.data;
    const recipe = await db.query.recipes.findFirst({
      where: and(
        eq(recipes.id, params.id),
        eq(recipes.userId, user.userId)
      )
    });
    if (!recipe) {
      throw error(404, 'Recipe not found');
    }
    const existingPhotos = await db.query.recipePhotos.findMany({
      where: eq(recipePhotos.recipeId, params.id)
    });
    if (existingPhotos.length >= 5) {
      throw error(400, 'Maximum of 5 photos per recipe reached');
    }
    const photo = await db.query.photos.findFirst({
      where: eq(photos.id, photoId)
    });
    if (!photo) {
      throw error(404, 'Photo not found');
    }
    if (photo.accountId !== user.userId) {
      throw error(403, 'Not authorized to use this photo');
    }
    const alreadyLinked = existingPhotos.some(p => p.photoId === photoId);
    if (alreadyLinked) {
      return json({ success: true });
    }
    const isMain = existingPhotos.length === 0;
    const maxSortOrder = existingPhotos.reduce((max, p) => Math.max(max, p.sortOrder), -1);
    await db.insert(recipePhotos).values({
      recipeId: params.id,
      photoId,
      isMain,
      sortOrder: maxSortOrder + 1
    });

    photoCache.invalidate(params.id);

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Add recipe photo error:', e);
    throw error(500, 'Internal server error');
  }
};
