import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getAdminIdForUser, getStorageProviderForAdmin } from '$lib/server/storage/service';
export const PUT: RequestHandler = async ({ url, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }
    const key = url.searchParams.get('key');
    if (!key) {
      throw error(400, 'key is required');
    }
    const pathParts = key.split('/');
    if (pathParts.length < 2) {
      throw error(400, 'Invalid storage key');
    }
    const accountId = pathParts[0];
    if (accountId !== user.userId) {
      const adminId = await getAdminIdForUser(user.userId);
      if (adminId !== accountId && !user.isAdmin) {
        throw error(403, 'Access denied');
      }
    }
    const body = request.body;
    if (!body) {
      throw error(400, 'No body provided');
    }
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    const chunks: Uint8Array[] = [];
    const reader = body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    const adminId = await getAdminIdForUser(user.userId);
    const provider = await getStorageProviderForAdmin(adminId);
    if (!provider) {
      throw error(500, 'Storage provider not available');
    }
    await (provider as any).uploadBuffer(key, buffer, contentType);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Upload file error:', e);
    throw error(500, 'Internal server error');
  }
};