import { db } from '$lib/server/db/db.js';
import { photos, recipes } from '$lib/server/db/schema.js';
import { eq, isNotNull, inArray } from 'drizzle-orm';
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
      where: isNotNull(photos.recipeId)
    });

    if (photosWithRecipeId.length === 0) {
      return result;
    }

    const photoRecipeIds = photosWithRecipeId
      .map(p => p.recipeId)
      .filter((id): id is string => id !== null);

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
          await provider.delete(photo);
          result.deletedFiles += 3;
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

export async function cleanupOrphanedPhotos(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedPhotos: 0,
    deletedFiles: 0,
    errors: []
  };

  try {
    const orphanedPhotos = await db.query.photos.findMany({
      where: isNotNull(photos.recipeId)
    });

    const validRecipeIds = new Set<string>();
    for (const photo of orphanedPhotos) {
      if (photo.recipeId) {
        const recipe = await db.query.recipes.findFirst({
          where: eq(recipes.id, photo.recipeId)
        });
        if (!recipe) {
          validRecipeIds.add(photo.id);
        }
      }
    }

    const orphanedWithIds = orphanedPhotos.filter(p => validRecipeIds.has(p.id));

    for (const photo of orphanedWithIds) {
      try {
        const provider = await getStorageProviderForAdmin(photo.adminId);
        if (provider) {
          await provider.delete(photo);
          result.deletedFiles += 3;
        }

        await db.delete(photos).where(eq(photos.id, photo.id));
        result.deletedPhotos++;
      } catch (error) {
        result.errors.push(`Failed to delete photo ${photo.id}: ${error}`);
      }
    }

    const unreferencedPhotos = await db.query.photos.findMany({
      where: isNotNull(photos.recipeId)
    });

    for (const photo of unreferencedPhotos) {
      if (photo.recipeId) {
        const recipe = await db.query.recipes.findFirst({
          where: eq(recipes.id, photo.recipeId)
        });

        if (!recipe) {
          try {
            const provider = await getStorageProviderForAdmin(photo.adminId);
            if (provider) {
              await provider.delete(photo);
              result.deletedFiles += 3;
            }
            await db.delete(photos).where(eq(photos.id, photo.id));
            result.deletedPhotos++;
          } catch (error) {
            result.errors.push(`Failed to cleanup photo ${photo.id}: ${error}`);
          }
        }
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
