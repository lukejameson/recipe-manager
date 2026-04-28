import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getAdminIdForUser, getStorageProviderForAdmin } from '$lib/server/storage/service';
export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const key = params.key;
    const pathParts = key.split('/');
    if (pathParts.length < 2) {
      throw error(400, 'Invalid storage key');
    }
    const accountId = pathParts[0];
    let adminId: string | null = null;
    if (accountId !== user.userId) {
      adminId = await getAdminIdForUser(user.userId);
      if (adminId !== accountId && !user.isAdmin) {
        throw error(403, 'Access denied');
      }
    }
    if (!adminId) {
      adminId = await getAdminIdForUser(user.userId);
    }
    const provider = await getStorageProviderForAdmin(adminId);
    if (!provider) {
      throw error(404, 'Storage not configured');
    }
    const fileBuffer = await (provider as any).getFile(key);
    if (!fileBuffer) {
      throw error(404, 'File not found');
    }
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'webp': 'image/webp',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml'
    };
    const contentType = mimeTypes[ext || ''] || 'application/octet-stream';
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Serve file error:', e);
    throw error(500, 'Internal server error');
  }
};