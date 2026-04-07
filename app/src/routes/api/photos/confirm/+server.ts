import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getStorageProviderForUser, getAdminIdForUser, getStorageConfigForUser } from '$lib/server/storage/service';
import { imageProcessor } from '$lib/server/storage/image-processor';
import { db } from '$lib/server/db/db';
import { photos } from '$lib/server/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';
import { encrypt, decrypt } from '$lib/server/utils/encryption';

const confirmSchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  recipeId: z.string().optional()
});

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = confirmSchema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { storageKey, mimeType, size, recipeId } = result.data;

    const storageConfig = await getStorageConfigForUser(user.userId);
    if (!storageConfig) {
      throw error(400, 'No storage configured for this account');
    }

    const adminId = await getAdminIdForUser(user.userId);
    const provider = await getStorageProviderForUser(adminId);
    if (!provider) {
      throw error(500, 'Storage provider not available');
    }

    const maxSizeMb = storageConfig.maxUploadSizeMb || 10;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (size > maxSizeBytes) {
      throw error(400, `File size exceeds maximum of ${maxSizeMb}MB`);
    }

if (recipeId) {
      const photoCount = await db.query.photos.findMany({
        where: and(
          eq(photos.recipeId, recipeId),
          eq(photos.accountId, user.userId)
        )
      });
      if (photoCount.length >= 5) {
        await provider.deleteKey(storageKey);
        throw error(400, 'Maximum of 5 photos per recipe reached');
      }
    }

    let originalBuffer: Buffer | null = null;
    originalBuffer = await (provider as any).getFile(storageKey);

    if (!originalBuffer) {
      await provider.deleteKey(storageKey);
      throw error(500, 'Failed to retrieve uploaded file');
    }

    const thumbnailKey = storageKey.replace(/(\.[^.]+)$/, '_thumb.webp');
    const mediumKey = storageKey.replace(/(\.[^.]+)$/, '_medium.webp');

    try {
      const processed = await imageProcessor.processImage(originalBuffer);
      await (provider as any).uploadBuffer(thumbnailKey, processed.thumbnail.buffer, 'image/webp');
      await (provider as any).uploadBuffer(mediumKey, processed.medium.buffer, 'image/webp');
      await (provider as any).uploadBuffer(storageKey, processed.original.buffer, 'image/webp');

      const [newPhoto] = await db.insert(photos).values({
        accountId: user.userId,
        adminId,
        recipeId: recipeId || null,
        originalKey: storageKey,
        thumbnailKey,
        mediumKey,
        originalSize: size,
        mimeType: 'image/webp',
        width: processed.original.width,
        height: processed.original.height
      }).returning();
      const [originalUrl, thumbnailUrl, mediumUrl] = await Promise.all([
        provider.getDownloadUrl(newPhoto, 'original'),
        provider.getDownloadUrl(newPhoto, 'thumbnail'),
        provider.getDownloadUrl(newPhoto, 'medium')
      ]);
      return json({
        id: newPhoto.id,
        originalKey: newPhoto.originalKey,
        thumbnailKey: newPhoto.thumbnailKey,
        mediumKey: newPhoto.mediumKey,
        width: newPhoto.width,
        height: newPhoto.height,
        mimeType: newPhoto.mimeType,
        urls: {
          original: originalUrl,
          thumbnail: thumbnailUrl,
          medium: mediumUrl
        }
      });
    } catch (processError) {
      await provider.deleteKey(storageKey);
      throw processError;
    }
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Confirm upload error:', e);
    throw error(500, 'Internal server error');
  }
};
