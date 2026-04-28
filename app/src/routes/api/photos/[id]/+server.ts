import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getStorageProviderForUser, getAdminIdForUser } from '$lib/server/storage/service';
import { db } from '$lib/server/db/db';
import { photos, recipePhotos } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { photoCache } from '$lib/server/cache/photo-cache';

export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const photo = await db.query.photos.findFirst({
      where: and(
        eq(photos.id, params.id),
        eq(photos.accountId, user.userId)
      )
    });

    if (!photo) {
      throw error(404, 'Photo not found');
    }

    const adminId = await getAdminIdForUser(user.userId);
    const provider = await getStorageProviderForUser(adminId);
    if (!provider) {
      throw error(500, 'Storage provider not available');
    }

    const [originalUrl, thumbnailUrl, mediumUrl] = await Promise.all([
      provider.getDownloadUrl(photo, 'original'),
      provider.getDownloadUrl(photo, 'thumbnail'),
      provider.getDownloadUrl(photo, 'medium')
    ]);

    return json({
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
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get photo error:', e);
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

    const photo = await db.query.photos.findFirst({
      where: and(
        eq(photos.id, params.id),
        eq(photos.accountId, user.userId)
      )
    });

    if (!photo) {
      throw error(404, 'Photo not found');
    }

    const adminId = await getAdminIdForUser(user.userId);
    const provider = await getStorageProviderForUser(adminId);
    if (provider) {
      await provider.delete(photo);
    }

    const linkedRecipes = await db.query.recipePhotos.findMany({
      where: eq(recipePhotos.photoId, params.id)
    });
    const recipeIds = linkedRecipes.map(rp => rp.recipeId);
    if (recipeIds.length > 0) {
      photoCache.invalidateMultiple(recipeIds);
    }

    await db.delete(photos).where(eq(photos.id, params.id));
    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete photo error:', e);
    throw error(500, 'Internal server error');
  }
};
