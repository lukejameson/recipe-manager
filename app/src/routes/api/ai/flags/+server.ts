import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users, DEFAULT_FEATURE_FLAGS } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';

// GET /api/ai/flags - Get user's feature flags
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    const featureFlags = userRecord?.featureFlags ?? DEFAULT_FEATURE_FLAGS;

    return json({
      aiChat: featureFlags.aiChat,
      recipeGeneration: featureFlags.recipeGeneration,
      tagSuggestions: featureFlags.tagSuggestions,
      nutritionCalc: featureFlags.nutritionCalc,
      photoExtraction: featureFlags.photoExtraction,
      urlImport: featureFlags.urlImport,
      imageSearch: featureFlags.imageSearch,
      textImport: featureFlags.textImport,
    });
  } catch (e) {
    if ('status' in e) throw e;
    console.error('Get AI flags error:', e);
    throw error(500, 'Internal server error');
  }
};
