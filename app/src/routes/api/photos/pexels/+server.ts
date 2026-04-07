import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getStorageProviderForUser, getAdminIdForUser, getStorageConfigForUser } from '$lib/server/storage/service';
import { imageProcessor } from '$lib/server/storage/image-processor';
import { db } from '$lib/server/db/db';
import { photos, settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string().min(1),
  perPage: z.number().min(1).max(30).default(15)
});

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const query = url.searchParams.get('query');
    const perPage = parseInt(url.searchParams.get('per_page') || '15');

    if (!query) {
      throw error(400, 'query is required');
    }

    const pexelsApiKey = await getPexelsApiKey();
    if (!pexelsApiKey) {
      throw error(400, 'Pexels API key not configured');
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`,
      {
        headers: {
          Authorization: pexelsApiKey
        }
      }
    );

    if (!response.ok) {
      throw error(502, 'Pexels API error');
    }

    const data = await response.json();

    return json({
      photos: data.photos.map((p: any) => ({
        id: p.id,
        width: p.width,
        height: p.height,
        url: p.src.large2x || p.src.large,
        thumbnailUrl: p.src.tiny,
        photographer: p.photographer,
        alt: p.alt
      })),
      totalResults: data.total_results,
      page: data.page,
      perPage: data.per_page
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Pexels search error:', e);
    throw error(500, 'Internal server error');
  }
};

const downloadSchema = z.object({
  pexelsId: z.string(),
  url: z.string().url(),
  photographer: z.string().optional(),
  alt: z.string().optional()
});

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = downloadSchema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { pexelsId, url, photographer, alt } = result.data;

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
      throw error(502, 'Failed to download image from Pexels');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const processed = await imageProcessor.processImage(buffer);

    const timestamp = Date.now();
    const storageKey = `${user.userId}/${timestamp}_pexels_${pexelsId}.webp`;

    if (provider.provider === 'local') {
      const localProvider = provider as any;
      await localProvider.uploadBuffer(storageKey, processed.original.buffer, 'image/webp');
      await localProvider.uploadBuffer(
        storageKey.replace('.webp', '_thumb.webp'),
        processed.thumbnail.buffer,
        'image/webp'
      );
      await localProvider.uploadBuffer(
        storageKey.replace('.webp', '_medium.webp'),
        processed.medium.buffer,
        'image/webp'
      );
    } else {
      const s3Provider = provider as any;
      await s3Provider.uploadBuffer(storageKey, processed.original.buffer, 'image/webp');
      await s3Provider.uploadBuffer(
        storageKey.replace('.webp', '_thumb.webp'),
        processed.thumbnail.buffer,
        'image/webp'
      );
      await s3Provider.uploadBuffer(
        storageKey.replace('.webp', '_medium.webp'),
        processed.medium.buffer,
        'image/webp'
      );
    }

    const [newPhoto] = await db.insert(photos).values({
      accountId: user.userId,
      adminId,
      originalKey: storageKey,
      thumbnailKey: storageKey.replace('.webp', '_thumb.webp'),
      mediumKey: storageKey.replace('.webp', '_medium.webp'),
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
      urls: {
        thumbnail: `/api/photos/serve/${encodeURIComponent(newPhoto.thumbnailKey!)}`,
        medium: `/api/photos/serve/${encodeURIComponent(newPhoto.mediumKey!)}`,
        original: `/api/photos/serve/${encodeURIComponent(newPhoto.originalKey)}`
      }
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Pexels download error:', e);
    throw error(500, 'Internal server error');
  }
};

async function getPexelsApiKey(): Promise<string | null> {
  const appSettings = await db.query.settings.findFirst({
    where: eq(settings.id, 'app-settings')
  });
  return appSettings?.pexelsApiKey || null;
}
