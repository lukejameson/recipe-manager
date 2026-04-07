import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getStorageProviderForUser, getAdminIdForUser } from '$lib/server/storage/service';
import { db } from '$lib/server/db/db';
import { photos, recipes } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const recipe = await db.query.recipes.findFirst({
      where: and(
        eq(recipes.id, params.recipeId),
        eq(recipes.userId, user.userId)
      )
    });

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    const recipePhotos = await db.query.photos.findMany({
      where: and(
        eq(photos.recipeId, params.recipeId),
        eq(photos.accountId, user.userId)
      )
    });

    if (recipePhotos.length === 0) {
      return json([]);
    }

    const adminId = await getAdminIdForUser(user.userId);
    const provider = await getStorageProviderForUser(adminId);
    if (!provider) {
      throw error(500, 'Storage provider not available');
    }

    const photosWithUrls = await Promise.all(
      recipePhotos.map(async (photo) => {
        const [originalUrl, thumbnailUrl, mediumUrl] = await Promise.all([
          provider.getDownloadUrl(photo, 'original'),
          provider.getDownloadUrl(photo, 'thumbnail'),
          provider.getDownloadUrl(photo, 'medium')
        ]);

        return {
          id: photo.id,
          recipeId: photo.recipeId,
          originalKey: photo.originalKey,
          thumbnailKey: photo.thumbnailKey,
          mediumKey: photo.mediumKey,
          originalSize: photo.originalSize,
          mimeType: photo.mimeType,
          width: photo.width,
          height: photo.height,
          urls: {
            original: originalUrl,
            thumbnail: thumbnailUrl,
            medium: mediumUrl
          },
          createdAt: photo.createdAt
        };
      })
    );

    return json(photosWithUrls);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get recipe photos error:', e);
    throw error(500, 'Internal server error');
  }
};
