import type { StorageProvider, StorageConfigInput } from './base.js';
import type { StorageConfig, R2Config, S3Config, LocalConfig, Photo } from '$lib/server/db/schema.js';
import { R2StorageProvider } from './r2.js';
import { S3StorageProvider } from './s3.js';
import { LocalStorageProvider } from './local.js';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db/db.js';
import { storageConfigs, users } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

let localProvider: LocalStorageProvider | null = null;

export function getLocalStorageProvider(): LocalStorageProvider {
  if (!localProvider) {
    localProvider = new LocalStorageProvider();
  }
  return localProvider;
}

export async function getStorageProviderForAdmin(adminId: string): Promise<StorageProvider | null> {
  const isLocalEnabled = env?.LOCAL_PHOTO_STORAGE === 'true' || process.env.LOCAL_PHOTO_STORAGE === 'true';
  if (isLocalEnabled) {
    return getLocalStorageProvider();
  }
  const config = await db.query.storageConfigs.findFirst({
    where: eq(storageConfigs.adminId, adminId)
  });
  if (!config) {
    return null;
  }
  return createStorageProvider(config);
}

export async function getStorageProviderForUser(userId: string): Promise<StorageProvider | null> {
  const adminId = await getAdminIdForUser(userId);
  return getStorageProviderForAdmin(adminId);
}

export function createStorageProvider(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case 'r2':
      return new R2StorageProvider(
        config.config as R2Config,
        config.cdnUrl || undefined
      );
    case 's3':
      return new S3StorageProvider(
        config.config as S3Config,
        config.cdnUrl || undefined
      );
    case 'local':
      return getLocalStorageProvider();
    default:
      throw new Error(`Unknown storage provider: ${config.provider}`);
  }
}

export function isStorageConfigured(config: StorageConfig | null | undefined): boolean {
  if (!config) return false;
  return config.provider === 'local' || (config.config as any) !== null;
}

export async function getStorageConfigForAdmin(adminId: string): Promise<StorageConfig | null> {
  const isLocalEnabled = env?.LOCAL_PHOTO_STORAGE === 'true' || process.env.LOCAL_PHOTO_STORAGE === 'true';

  if (isLocalEnabled) {
    return {
      id: 'local',
      adminId: 'local',
      provider: 'local',
      config: { path: env?.LOCAL_PHOTO_STORAGE_PATH || process.env.LOCAL_PHOTO_STORAGE_PATH || '/data/photos' } as LocalConfig,
      cdnUrl: null,
      maxUploadSizeMb: 10,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  return db.query.storageConfigs.findFirst({
    where: eq(storageConfigs.adminId, adminId)
  });
}

export async function getStorageConfigForUser(userId: string): Promise<StorageConfig | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  if (!user) return null;

  if (user.isAdmin) {
    return getStorageConfigForAdmin(user.id);
  }

  if (user.adminId) {
    return getStorageConfigForAdmin(user.adminId);
  }

  return getStorageConfigForAdmin(user.id);
}

export async function getAdminIdForUser(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  if (!user) throw new Error('User not found');

  if (user.isAdmin) {
    return user.id;
  }

  if (user.adminId) {
    return user.adminId;
  }

  return user.id;
}

export async function upsertStorageConfig(
  adminId: string,
  input: StorageConfigInput
): Promise<StorageConfig> {
  const existing = await db.query.storageConfigs.findFirst({
    where: eq(storageConfigs.adminId, adminId)
  });

  if (existing) {
    await db.update(storageConfigs)
      .set({
        provider: input.provider,
        config: input.config as any,
        cdnUrl: input.cdnUrl || null,
        maxUploadSizeMb: input.maxUploadSizeMb || 10,
        updatedAt: new Date()
      })
      .where(eq(storageConfigs.adminId, adminId));
  } else {
    await db.insert(storageConfigs).values({
      adminId,
      provider: input.provider,
      config: input.config as any,
      cdnUrl: input.cdnUrl || null,
      maxUploadSizeMb: input.maxUploadSizeMb || 10
    });
  }

  return (await getStorageConfigForAdmin(adminId))!;
}

export async function deleteStorageConfig(adminId: string): Promise<void> {
  await db.delete(storageConfigs)
    .where(eq(storageConfigs.adminId, adminId));
}

export { type StorageProvider, type UploadUrlResult, type PhotoMetadata } from './base.js';
