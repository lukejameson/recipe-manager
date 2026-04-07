import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import type { StorageProvider, UploadUrlResult } from './base.js';
import type { Photo, R2Config } from '$lib/server/db/schema.js';
import { decrypt } from '$lib/server/utils/encryption.js';
export class R2StorageProvider implements StorageProvider {
  readonly provider = 'r2' as const;
  private client: S3Client;
  private config: R2Config;
  private cdnUrl?: string;
  constructor(config: R2Config, cdnUrl?: string) {
    this.config = config;
    this.cdnUrl = cdnUrl;
    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: decrypt(config.accessKeyId),
        secretAccessKey: decrypt(config.secretAccessKey)
      }
    });
  }
  private getBucket(): string {
    return this.config.bucket;
  }
  private getPublicUrl(key: string): string {
    if (this.cdnUrl) {
      return `${this.cdnUrl.replace(/\/$/, '')}/${key}`;
    }
    return `/api/photos/serve/${encodeURIComponent(key)}`;
  }
  async createUploadUrl(filename: string, contentType: string, accountId: string): Promise<UploadUrlResult> {
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${accountId}/${timestamp}_${safeFilename}`;
    return {
      uploadUrl: `/api/photos/upload-local?key=${encodeURIComponent(storageKey)}`,
      publicUrl: this.getPublicUrl(storageKey),
      storageKey
    };
  }
  async confirmUpload(storageKey: string, metadata: { mimeType: string; size: number }): Promise<void> {
    const command = new HeadObjectCommand({
      Bucket: this.getBucket(),
      Key: storageKey
    });
    await this.client.send(command);
  }
  async getDownloadUrl(photo: Photo, variant?: 'original' | 'thumbnail' | 'medium'): Promise<string> {
    let key = photo.originalKey;
    if (variant === 'thumbnail' && photo.thumbnailKey) {
      key = photo.thumbnailKey;
    } else if (variant === 'medium' && photo.mediumKey) {
      key = photo.mediumKey;
    }
    return this.getPublicUrl(key);
  }
  async getMetadata(storageKey: string): Promise<{ width: number; height: number; mimeType: string } | null> {
    try {
      const fileBuffer = await this.getFile(storageKey);
      if (!fileBuffer) return null;
      const metadata = await sharp(fileBuffer).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        mimeType: metadata.format ? `image/${metadata.format}` : 'image/webp'
      };
    } catch {
      return null;
    }
  }
  async delete(photo: Photo): Promise<void> {
    const keys = [photo.originalKey, photo.thumbnailKey, photo.mediumKey].filter(Boolean);
    for (const key of keys) {
      await this.deleteKey(key);
    }
  }
  async deleteKey(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.getBucket(),
      Key: storageKey
    });
    await this.client.send(command);
  }
  async list(prefix: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.getBucket(),
      Prefix: prefix
    });
    const response = await this.client.send(command);
    return (response.Contents || []).map(obj => obj.Key || '');
  }
  async healthCheck(): Promise<boolean> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.getBucket(),
        Prefix: '',
        MaxKeys: 1
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
  async invalidateCdn(paths: string[]): Promise<void> {
    if (!this.cdnUrl) return;
  }
  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType
    });
    await this.client.send(command);
  }
  async getFile(key: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.getBucket(),
        Key: key
      });
      const response = await this.client.send(command);
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }
}
