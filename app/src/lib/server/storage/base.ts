import type { Photo, StorageConfig } from '$lib/server/db/schema.js';
import type { R2Config, S3Config, LocalConfig } from '$lib/server/db/schema.js';

export type { R2Config, S3Config, LocalConfig };

export interface UploadUrlResult {
  uploadUrl: string;
  publicUrl: string;
  storageKey: string;
}

export interface PhotoMetadata {
  id: string;
  originalKey: string;
  thumbnailKey: string | null;
  mediumKey: string | null;
  originalSize: number;
  mimeType: string;
  width: number;
  height: number;
  publicUrl: string;
  thumbnailUrl: string | null;
  mediumUrl: string | null;
}

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
  size: number;
}

export interface ImageVariants {
  original: ProcessedImage;
  thumbnail: ProcessedImage;
  medium: ProcessedImage;
}

export interface StorageProvider {
  readonly provider: 'local' | 'r2' | 's3';

  createUploadUrl(
    filename: string,
    contentType: string,
    accountId: string
  ): Promise<UploadUrlResult>;

  confirmUpload(storageKey: string, metadata: { mimeType: string; size: number }): Promise<void>;

  getDownloadUrl(photo: Photo, variant?: 'original' | 'thumbnail' | 'medium'): Promise<string>;

  getMetadata(storageKey: string): Promise<{ width: number; height: number; mimeType: string } | null>;

  delete(photo: Photo): Promise<void>;

  deleteKey(storageKey: string): Promise<void>;

  list(prefix: string): Promise<string[]>;

  healthCheck(): Promise<boolean>;

  invalidateCdn?(paths: string[]): Promise<void>;

  uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void>;

  getFile(key: string): Promise<Buffer | null>;
}

export interface StorageConfigInput {
  provider: 'local' | 'r2' | 's3';
  config: R2Config | S3Config | LocalConfig;
  cdnUrl?: string;
  maxUploadSizeMb?: number;
}

export function isR2Config(config: R2Config | S3Config | LocalConfig): config is R2Config {
  return 'accountId' in config;
}

export function isS3Config(config: R2Config | S3Config | LocalConfig): config is S3Config {
  return 'region' in config && !isR2Config(config);
}

export function isLocalConfig(config: R2Config | S3Config | LocalConfig): config is LocalConfig {
  return 'path' in config;
}

export function getStorageKeyForVariant(
  baseKey: string,
  variant: 'original' | 'thumbnail' | 'medium'
): string {
  const ext = '.webp';
  const base = baseKey.replace(/\.[^.]+$/, '');
  switch (variant) {
    case 'thumbnail':
      return `${base}_thumb${ext}`;
    case 'medium':
      return `${base}_medium${ext}`;
    default:
      return baseKey;
  }
}
