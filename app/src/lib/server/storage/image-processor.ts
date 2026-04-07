import sharp from 'sharp';
import type { ProcessedImage, ImageVariants } from './base.js';

export interface ImageProcessorOptions {
  thumbnailMaxSize: number;
  mediumMaxSize: number;
  thumbnailQuality: number;
  mediumQuality: number;
  originalQuality: number;
}

const DEFAULT_OPTIONS: ImageProcessorOptions = {
  thumbnailMaxSize: 200,
  mediumMaxSize: 800,
  thumbnailQuality: 80,
  mediumQuality: 85,
  originalQuality: 90
};

export class ImageProcessor {
  private options: ImageProcessorOptions;

  constructor(options: Partial<ImageProcessorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async processImage(input: Buffer | Uint8Array): Promise<ImageVariants> {
    const image = sharp(input);
    const metadata = await image.metadata();

    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const mimeType = metadata.format === 'jpeg' ? 'image/jpeg'
      : metadata.format === 'png' ? 'image/png'
      : metadata.format === 'webp' ? 'image/webp'
      : metadata.format === 'gif' ? 'image/gif'
      : 'image/webp';

    const originalBuffer = await this.processOriginal(input, mimeType);
    const thumbnailBuffer = await this.processVariant(input, this.options.thumbnailMaxSize, this.options.thumbnailQuality);
    const mediumBuffer = await this.processVariant(input, this.options.mediumMaxSize, this.options.mediumQuality);

    const [originalMeta, thumbnailMeta, mediumMeta] = await Promise.all([
      sharp(originalBuffer).metadata(),
      sharp(thumbnailBuffer).metadata(),
      sharp(mediumBuffer).metadata()
    ]);

    return {
      original: {
        buffer: originalBuffer,
        width: originalMeta.width || width,
        height: originalMeta.height || height,
        mimeType: 'image/webp',
        size: originalBuffer.length
      },
      thumbnail: {
        buffer: thumbnailBuffer,
        width: thumbnailMeta.width || Math.min(width, this.options.thumbnailMaxSize),
        height: thumbnailMeta.height || Math.min(height, this.options.thumbnailMaxSize),
        mimeType: 'image/webp',
        size: thumbnailBuffer.length
      },
      medium: {
        buffer: mediumBuffer,
        width: mediumMeta.width || Math.min(width, this.options.mediumMaxSize),
        height: mediumMeta.height || Math.min(height, this.options.mediumMaxSize),
        mimeType: 'image/webp',
        size: mediumBuffer.length
      }
    };
  }

  private async processOriginal(input: Buffer | Uint8Array, _mimeType: string): Promise<Buffer> {
    return sharp(input)
      .webp({ quality: this.options.originalQuality })
      .toBuffer();
  }

  private async processVariant(input: Buffer | Uint8Array, maxSize: number, quality: number): Promise<Buffer> {
    return sharp(input)
      .resize(maxSize, maxSize, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality })
      .toBuffer();
  }

  async getMetadata(input: Buffer | Uint8Array): Promise<{ width: number; height: number; mimeType: string }> {
    const metadata = await sharp(input).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      mimeType: metadata.format === 'jpeg' ? 'image/jpeg'
        : metadata.format === 'png' ? 'image/png'
        : metadata.format === 'webp' ? 'image/webp'
        : metadata.format === 'gif' ? 'image/gif'
        : 'image/webp'
    };
  }

  async convertToWebP(input: Buffer | Uint8Array, quality: number = 85): Promise<Buffer> {
    return sharp(input)
      .webp({ quality })
      .toBuffer();
  }
}

export const imageProcessor = new ImageProcessor();
