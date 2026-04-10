import { db } from '$lib/server/db/db.js';
import { photos, recipes } from '$lib/server/db/schema.js';
import { eq, isNull, inArray } from 'drizzle-orm';
import { getStorageProviderForAdmin } from './service.js';

export interface CleanupResult {
  deletedPhotos: number;
  deletedFiles: number;
  errors: string[];
}

export async function cleanupOrphanedPhotos(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedPhotos: 0,
    deletedFiles: 0,
    errors: []
  };
  try {
    const photosWithRecipeId = await db.query.photos.findMany({
      where: isNull(photos.recipeId)
    });
    if (photosWithRecipeId.length === 0) {
      return result;
    }
    const photoRecipeIds = photosWithRecipeId
      .map(p => p.recipeId)
      .filter((id): id is string => id !== null);
    if (photoRecipeIds.length === 0) {
      return result;
    }
    const existingRecipes = await db.query.recipes.findMany({
      where: inArray(recipes.id, photoRecipeIds)
    });
    const existingRecipeIds = new Set(existingRecipes.map(r => r.id));
    const orphanedPhotos = photosWithRecipeId.filter(
      p => p.recipeId && !existingRecipeIds.has(p.recipeId)
    );
    for (const photo of orphanedPhotos) {
      try {
        const provider = await getStorageProviderForAdmin(photo.adminId);
        if (provider) {
          const keys = [photo.originalKey, photo.thumbnailKey, photo.mediumKey].filter(Boolean) as string[];
          await Promise.allSettled(keys.map(k => provider.deleteKey(k)));
          result.deletedFiles += keys.length;
        }
        await db.delete(photos).where(eq(photos.id, photo.id));
        result.deletedPhotos++;
      } catch (error) {
        result.errors.push(`Failed to delete photo ${photo.id}: ${error}`);
      }
    }
  } catch (error) {
    result.errors.push(`Cleanup error: ${error}`);
  }
  return result;
}

export async function getStorageStats(adminId: string): Promise<{
  totalPhotos: number;
  totalSize: number;
  byAccount: { accountId: string; count: number; size: number }[];
}> {
  const allPhotos = await db.query.photos.findMany({
    where: eq(photos.adminId, adminId)
  });
  const byAccount = new Map<string, { count: number; size: number }>();
  for (const photo of allPhotos) {
    const existing = byAccount.get(photo.accountId) || { count: 0, size: 0 };
    existing.count++;
    existing.size += photo.originalSize || 0;
    byAccount.set(photo.accountId, existing);
  }
  return {
    totalPhotos: allPhotos.length,
    totalSize: allPhotos.reduce((sum, p) => sum + (p.originalSize || 0), 0),
    byAccount: Array.from(byAccount.entries()).map(([accountId, data]) => ({
      accountId,
      ...data
    }))
  };
}
