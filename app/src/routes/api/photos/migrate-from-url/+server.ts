import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getStorageProviderForUser, getAdminIdForUser, getStorageConfigForUser } from '$lib/server/storage/service';
import { imageProcessor } from '$lib/server/storage/image-processor';
import { db } from '$lib/server/db/db';
import { photos } from '$lib/server/db/schema';
import { z } from 'zod';

const migrateSchema = z.object({
  url: z.string().url(),
  recipeId: z.string().uuid().optional()
});

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = migrateSchema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { url, recipeId } = result.data;

    const storageConfig = await getStorageConfigForUser(user.userId);
    if (!storageConfig) {
      throw error(400, 'Storage not configured');
    }

    const adminId = await getAdminIdForUser(user.userId);
    const provider = await getStorageProviderForUser(adminId);
    if (!provider) {
      throw error(500, 'Storage provider not available');
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw error(502, 'Failed to download image from URL');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    const processed = await imageProcessor.processImage(buffer);

    const timestamp = Date.now();
    const safeFilename = url.split('/').pop()?.split('?')[0] || 'image';
    const ext = safeFilename.includes('.') ? safeFilename.split('.').pop() : 'webp';
    const storageKey = `${user.userId}/${timestamp}_migrated_${safeFilename}`;

    if (provider.provider === 'local') {
      const localProvider = provider as any;
      await localProvider.uploadBuffer(storageKey, processed.original.buffer, 'image/webp');
      await localProvider.uploadBuffer(
        storageKey.replace(/(\.[^.]+)$/, '_thumb.webp'),
        processed.thumbnail.buffer,
        'image/webp'
      );
      await localProvider.uploadBuffer(
        storageKey.replace(/(\.[^.]+)$/, '_medium.webp'),
        processed.medium.buffer,
        'image/webp'
      );
    } else {
      const s3Provider = provider as any;
      await s3Provider.uploadBuffer(storageKey, processed.original.buffer, 'image/webp');
      await s3Provider.uploadBuffer(
        storageKey.replace(/(\.[^.]+)$/, '_thumb.webp'),
        processed.thumbnail.buffer,
        'image/webp'
      );
      await s3Provider.uploadBuffer(
        storageKey.replace(/(\.[^.]+)$/, '_medium.webp'),
        processed.medium.buffer,
        'image/webp'
      );
    }

    const [newPhoto] = await db.insert(photos).values({
      accountId: user.userId,
      adminId,
      recipeId: recipeId || null,
      originalKey: storageKey,
      thumbnailKey: storageKey.replace(/(\.[^.]+)$/, '_thumb.webp'),
      mediumKey: storageKey.replace(/(\.[^.]+)$/, '_medium.webp'),
      originalSize: processed.original.size,
      originalUrl: url,
      mimeType: 'image/webp',
      width: processed.original.width,
      height: processed.original.height
    }).returning();

    return json({
      id: newPhoto.id,
      width: newPhoto.width,
      height: newPhoto.height,
      originalUrl: url,
      urls: {
        thumbnail: `/api/photos/serve/${encodeURIComponent(newPhoto.thumbnailKey!)}`,
        medium: `/api/photos/serve/${encodeURIComponent(newPhoto.mediumKey!)}`,
        original: `/api/photos/serve/${encodeURIComponent(newPhoto.originalKey)}`
      }
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Migrate from URL error:', e);
    throw error(500, 'Internal server error');
  }
};
