import {
  statSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'fs';
import { join } from 'path';
import type { StorageProvider, UploadUrlResult } from './base.js';
import type { Photo } from '$lib/server/db/schema.js';
import { env } from '$env/dynamic/private';

export class LocalStorageProvider implements StorageProvider {
  readonly provider = 'local' as const;

  private getBasePath(): string {
    const path = env?.LOCAL_PHOTO_STORAGE_PATH || process.env.LOCAL_PHOTO_STORAGE_PATH || '/data/photos';
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
    return path;
  }

  private getAccountPath(accountId: string): string {
    const accountPath = join(this.getBasePath(), accountId);
    if (!existsSync(accountPath)) {
      mkdirSync(accountPath, { recursive: true });
    }
    return accountPath;
  }

  async createUploadUrl(filename: string, _contentType: string, accountId: string): Promise<UploadUrlResult> {
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${accountId}/${timestamp}_${safeFilename}`;
    const localPath = join(this.getBasePath(), storageKey);

    const dir = join(this.getBasePath(), accountId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    return {
      uploadUrl: `/api/photos/upload-local?key=${encodeURIComponent(storageKey)}`,
      publicUrl: `/api/photos/serve/${storageKey}`,
      storageKey
    };
  }

  async confirmUpload(storageKey: string, metadata: { mimeType: string; size: number }): Promise<void> {
    const localPath = join(this.getBasePath(), storageKey);
    if (!existsSync(localPath)) {
      throw new Error(`File not found: ${storageKey}`);
    }
  }

  async getDownloadUrl(photo: Photo, variant?: 'original' | 'thumbnail' | 'medium'): Promise<string> {
    let key = photo.originalKey;
    if (variant === 'thumbnail' && photo.thumbnailKey) {
      key = photo.thumbnailKey;
    } else if (variant === 'medium' && photo.mediumKey) {
      key = photo.mediumKey;
    }
    return `/api/photos/serve/${key}`;
  }

  async getMetadata(storageKey: string): Promise<{ width: number; height: number; mimeType: string } | null> {
    const localPath = join(this.getBasePath(), storageKey);
    if (!existsSync(localPath)) {
      return null;
    }
    const stat = statSync(localPath);
    return {
      width: 0,
      height: 0,
      mimeType: 'image/webp'
    };
  }

  async delete(photo: Photo): Promise<void> {
    const keys = [photo.originalKey, photo.thumbnailKey, photo.mediumKey].filter(Boolean);
    for (const key of keys) {
      await this.deleteKey(key!);
    }
  }

  async deleteKey(storageKey: string): Promise<void> {
    const localPath = join(this.getBasePath(), storageKey);
    if (existsSync(localPath)) {
      unlinkSync(localPath);
    }
  }

  async list(prefix: string): Promise<string[]> {
    const fullPath = join(this.getBasePath(), prefix);
    if (!existsSync(fullPath)) {
      return [];
    }
    try {
      const entries = readdirSync(fullPath, { withFileTypes: true });
      return entries
        .filter(e => e.isFile())
        .map(e => join(prefix, e.name).replace(/\\/g, '/'));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const path = this.getBasePath();
      return existsSync(path);
    } catch {
      return false;
    }
  }

  async saveFile(storageKey: string, buffer: Buffer): Promise<void> {
    const localPath = join(this.getBasePath(), storageKey);
    const dir = join(this.getBasePath(), storageKey.split('/').slice(0, -1).join('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(localPath, buffer);
  }

  async getFile(storageKey: string): Promise<Buffer | null> {
    const localPath = join(this.getBasePath(), storageKey);
    if (!existsSync(localPath)) {
      return null;
    }
    return readFileSync(localPath);
  }
}

export const localStorage = new LocalStorageProvider();
