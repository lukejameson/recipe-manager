import { TRPCError } from '@trpc/server';

// Maximum image size: 10MB (in bytes)
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// Maximum total size for all images in a request: 50MB
const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Calculate the size of a base64 encoded image in bytes
 * Base64 encoding adds ~33% overhead, so we calculate: (length * 3) / 4
 */
function getBase64SizeBytes(base64String: string): number {
  // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const base64Data = base64String.includes(',')
    ? base64String.split(',')[1]
    : base64String;

  // Calculate padding
  let padding = 0;
  if (base64Data.endsWith('==')) padding = 2;
  else if (base64Data.endsWith('=')) padding = 1;

  // Calculate decoded size
  return (base64Data.length * 3) / 4 - padding;
}

/**
 * Validate that a single base64 image is within size limits
 */
export function validateImageSize(base64Image: string): void {
  const sizeBytes = getBase64SizeBytes(base64Image);

  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    const maxMB = (MAX_IMAGE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Image too large (${sizeMB}MB). Maximum size is ${maxMB}MB. Please resize the image before uploading.`,
    });
  }
}

/**
 * Validate an array of base64 images for individual and total size limits
 */
export function validateImages(base64Images: string[]): void {
  let totalSize = 0;

  for (let i = 0; i < base64Images.length; i++) {
    const sizeBytes = getBase64SizeBytes(base64Images[i]);

    // Check individual image size
    if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      const maxMB = (MAX_IMAGE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Image ${i + 1} is too large (${sizeMB}MB). Maximum size per image is ${maxMB}MB.`,
      });
    }

    totalSize += sizeBytes;
  }

  // Check total size
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
    const maxMB = (MAX_TOTAL_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Total image size (${totalMB}MB) exceeds limit of ${maxMB}MB. Please reduce the number or size of images.`,
    });
  }
}

/**
 * Validate image groups for bulk operations
 */
export function validateImageGroups(imageGroups: string[][]): void {
  let totalSize = 0;

  for (let groupIdx = 0; groupIdx < imageGroups.length; groupIdx++) {
    const group = imageGroups[groupIdx];

    for (let imgIdx = 0; imgIdx < group.length; imgIdx++) {
      const sizeBytes = getBase64SizeBytes(group[imgIdx]);

      // Check individual image size
      if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
        const maxMB = (MAX_IMAGE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Image ${imgIdx + 1} in group ${groupIdx + 1} is too large (${sizeMB}MB). Maximum size per image is ${maxMB}MB.`,
        });
      }

      totalSize += sizeBytes;
    }
  }

  // Check total size
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
    const maxMB = (MAX_TOTAL_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Total image size (${totalMB}MB) exceeds limit of ${maxMB}MB. Please reduce the number or size of images.`,
    });
  }
}

/**
 * Check if a string looks like a valid base64 image
 */
export function isValidBase64Image(str: string): boolean {
  // Check for common image data URL prefixes
  const validPrefixes = [
    'data:image/jpeg',
    'data:image/jpg',
    'data:image/png',
    'data:image/gif',
    'data:image/webp',
    'data:image/heic',
    'data:image/heif',
  ];

  if (str.includes(',')) {
    const prefix = str.split(',')[0].toLowerCase();
    return validPrefixes.some(p => prefix.includes(p.split(':')[1].split('/')[1]));
  }

  // If no data URL prefix, check if it looks like valid base64
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str.substring(0, 100)); // Just check first 100 chars
}
