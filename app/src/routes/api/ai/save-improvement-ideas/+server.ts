import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const saveImprovementsSchema = z.object({
  id: z.string(),
  improvementIdeas: z.array(z.object({
    category: z.string(),
    suggestion: z.string(),
    explanation: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })),
});

// POST /api/ai/save-improvement-ideas - Save improvement ideas to a recipe
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = saveImprovementsSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { id, improvementIdeas } = result.data;

    // Verify recipe exists and belongs to user
    const [recipe] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.id, id))
      .limit(1);

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    await db
      .update(recipes)
      .set({ improvementIdeas })
      .where(eq(recipes.id, id));

    return json({ success: true });
  } catch (e) {
    if ('status' in e) throw e;
    console.error('Save improvement ideas error:', e);
    throw error(500, 'Internal server error');
  }
};