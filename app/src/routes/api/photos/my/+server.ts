import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { db } from '$lib/server/db/db';
import { photos } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const userPhotos = await db.query.photos.findMany({
      where: eq(photos.accountId, user.userId),
      orderBy: [desc(photos.createdAt)],
      limit: 100
    });

    const photosWithUrls = userPhotos.map(photo => ({
      id: photo.id,
      urls: {
        thumbnail: photo.thumbnailKey ? `/api/photos/serve/${photo.thumbnailKey}` : null,
        medium: photo.mediumKey ? `/api/photos/serve/${photo.mediumKey}` : null,
        original: `/api/photos/serve/${photo.originalKey}`
      },
      width: photo.width,
      height: photo.height,
      createdAt: photo.createdAt
    }));

    return json(photosWithUrls);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get my photos error:', e);
    throw error(500, 'Internal server error');
  }
};
