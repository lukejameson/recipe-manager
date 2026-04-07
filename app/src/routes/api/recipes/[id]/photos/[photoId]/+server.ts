import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { db } from '$lib/server/db/db';
import { photos, recipePhotos, recipes } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const PUT: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const recipe = await db.query.recipes.findFirst({
      where: and(
        eq(recipes.id, params.id),
        eq(recipes.userId, user.userId)
      )
    });

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    const recipePhoto = await db.query.recipePhotos.findFirst({
      where: and(
        eq(recipePhotos.recipeId, params.id),
        eq(recipePhotos.photoId, params.photoId)
      )
    });

    if (!recipePhoto) {
      throw error(404, 'Photo not associated with this recipe');
    }

    await db.update(recipePhotos)
      .set({ isMain: false })
      .where(eq(recipePhotos.recipeId, params.id));

    await db.update(recipePhotos)
      .set({ isMain: true })
      .where(and(
        eq(recipePhotos.recipeId, params.id),
        eq(recipePhotos.photoId, params.photoId)
      ));

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Set main photo error:', e);
    throw error(500, 'Internal server error');
  }
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const recipe = await db.query.recipes.findFirst({
      where: and(
        eq(recipes.id, params.id),
        eq(recipes.userId, user.userId)
      )
    });

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    const recipePhoto = await db.query.recipePhotos.findFirst({
      where: and(
        eq(recipePhotos.recipeId, params.id),
        eq(recipePhotos.photoId, params.photoId)
      )
    });

    if (!recipePhoto) {
      throw error(404, 'Photo not associated with this recipe');
    }

    await db.delete(recipePhotos)
      .where(and(
        eq(recipePhotos.recipeId, params.id),
        eq(recipePhotos.photoId, params.photoId)
      ));

    const remainingPhotos = await db.query.recipePhotos.findMany({
      where: eq(recipePhotos.recipeId, params.id),
      orderBy: recipePhotos.sortOrder
    });

    if (remainingPhotos.length > 0 && !remainingPhotos.some(p => p.isMain)) {
      await db.update(recipePhotos)
        .set({ isMain: true })
        .where(and(
          eq(recipePhotos.recipeId, params.id),
          eq(recipePhotos.photoId, remainingPhotos[0].photoId)
        ));
    }

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Remove recipe photo error:', e);
    throw error(500, 'Internal server error');
  }
};
