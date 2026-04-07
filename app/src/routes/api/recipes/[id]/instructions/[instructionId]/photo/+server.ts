import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { db } from '$lib/server/db/db';
import { photos, recipes } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RecipeItemList } from '$lib/server/db/schema';

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const { photoId } = await request.json();
    if (!photoId) {
      throw error(400, 'photoId is required');
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

    const photo = await db.query.photos.findFirst({
      where: eq(photos.id, photoId)
    });

    if (!photo) {
      throw error(404, 'Photo not found');
    }

    if (photo.accountId !== user.userId) {
      throw error(403, 'Not authorized to use this photo');
    }

    const instructions = recipe.instructions as RecipeItemList;
    const itemIndex = instructions.items.findIndex(item => item.id === params.instructionId);

    if (itemIndex === -1) {
      throw error(404, 'Instruction step not found');
    }

    const existingPhotoId = instructions.items[itemIndex].photoId;
    instructions.items[itemIndex].photoId = photoId;

    await db.update(recipes)
      .set({ instructions })
      .where(eq(recipes.id, params.id));

    return json({ success: true, previousPhotoId: existingPhotoId });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Attach instruction photo error:', e);
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

    const instructions = recipe.instructions as RecipeItemList;
    const itemIndex = instructions.items.findIndex(item => item.id === params.instructionId);

    if (itemIndex === -1) {
      throw error(404, 'Instruction step not found');
    }

    const existingPhotoId = instructions.items[itemIndex].photoId;
    if (!existingPhotoId) {
      throw error(404, 'No photo attached to this instruction');
    }

    delete instructions.items[itemIndex].photoId;

    await db.update(recipes)
      .set({ instructions })
      .where(eq(recipes.id, params.id));

    return json({ success: true, detachedPhotoId: existingPhotoId });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Detach instruction photo error:', e);
    throw error(500, 'Internal server error');
  }
};
