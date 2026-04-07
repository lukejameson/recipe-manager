import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getStorageConfigForAdmin, upsertStorageConfig, deleteStorageConfig, getStorageProviderForAdmin } from '$lib/server/storage/service';
import { db } from '$lib/server/db/db';
import { storageConfigs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { encrypt, decrypt } from '$lib/server/utils/encryption';
import { env } from '$env/dynamic/private';

const r2ConfigSchema = z.object({
  accountId: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucket: z.string().min(1)
});

const s3ConfigSchema = z.object({
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucket: z.string().min(1),
  endpoint: z.string().optional()
});

const storageConfigInputSchema = z.object({
  provider: z.enum(['local', 'r2', 's3']),
  config: z.union([r2ConfigSchema, s3ConfigSchema]),
  cdnUrl: z.string().optional(),
  maxUploadSizeMb: z.number().min(1).max(100).optional()
});

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!user.isAdmin) {
      throw error(403, 'Admin access required');
    }

    const isLocalEnabled = env?.LOCAL_PHOTO_STORAGE === 'true' || process.env.LOCAL_PHOTO_STORAGE === 'true';

    if (isLocalEnabled) {
      return json({
        provider: 'local',
        config: {
          path: env?.LOCAL_PHOTO_STORAGE_PATH || process.env.LOCAL_PHOTO_STORAGE_PATH || '/data/photos'
        },
        cdnUrl: null,
        maxUploadSizeMb: 10,
        isLocalEnabled: true
      });
    }

    const config = await getStorageConfigForAdmin(user.userId);
    if (!config) {
      return json(null);
    }

      return json({
        provider: config.provider,
        config: (() => {
          if (config.provider === 'r2') {
            return { ...config.config, secretAccessKey: '***' };
          }
          if (config.provider === 's3') {
            return { ...config.config, secretAccessKey: '***', accessKeyId: '***' };
          }
          return config.config;
        })(),
        cdnUrl: config.cdnUrl,
        maxUploadSizeMb: config.maxUploadSizeMb
      });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get storage config error:', e);
    throw error(500, 'Internal server error');
  }
};

export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!user.isAdmin) {
      throw error(403, 'Admin access required');
    }

    const isLocalEnabled = env?.LOCAL_PHOTO_STORAGE === 'true' || process.env.LOCAL_PHOTO_STORAGE === 'true';
    if (isLocalEnabled) {
      throw error(400, 'Local storage is enabled via environment variable');
    }

    const body = await request.json();
    const result = storageConfigInputSchema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { provider, config, cdnUrl, maxUploadSizeMb } = result.data;
    const encryptedConfig = { ...config };
    if ('accessKeyId' in encryptedConfig) {
      encryptedConfig.accessKeyId = encrypt(encryptedConfig.accessKeyId);
    }
    if ('secretAccessKey' in encryptedConfig) {
      encryptedConfig.secretAccessKey = encrypt(encryptedConfig.secretAccessKey);
    }
    const updated = await upsertStorageConfig(user.userId, {
      provider,
      config: encryptedConfig as any,
      cdnUrl,
      maxUploadSizeMb
    });

    const providerInstance = await getStorageProviderForAdmin(user.userId);
    if (providerInstance) {
      const healthy = await providerInstance.healthCheck();
      if (!healthy) {
        throw error(400, 'Storage provider health check failed');
      }
    }

    return json({
      provider: updated.provider,
      config: (() => {
        if (provider === 'r2') {
          return { ...updated.config, secretAccessKey: '***' };
        }
        if (provider === 's3') {
          return { ...updated.config, secretAccessKey: '***', accessKeyId: '***' };
        }
        return updated.config;
      })(),
      cdnUrl: updated.cdnUrl,
      maxUploadSizeMb: updated.maxUploadSizeMb
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update storage config error:', e);
    throw error(500, 'Internal server error');
  }
};

export const DELETE: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!user.isAdmin) {
      throw error(403, 'Admin access required');
    }

    await deleteStorageConfig(user.userId);

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Delete storage config error:', e);
    throw error(500, 'Internal server error');
  }
};
