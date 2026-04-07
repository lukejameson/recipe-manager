import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getStorageProviderForUser, getAdminIdForUser, getStorageConfigForUser } from '$lib/server/storage/service';
import { db } from '$lib/server/db/db';
import { photos } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const filename = url.searchParams.get('filename');
    const contentTypeParam = url.searchParams.get('contentType');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    const contentType = contentTypeParam && allowedTypes.includes(contentTypeParam) 
      ? contentTypeParam 
      : 'image/jpeg';

    if (!filename) {
      throw error(400, 'filename is required');
    }

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

    const result = await provider.createUploadUrl(filename, contentType, user.userId);

    return json({
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      storageKey: result.storageKey,
      maxSizeBytes
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get upload URL error:', e);
    throw error(500, 'Internal server error');
  }
};
