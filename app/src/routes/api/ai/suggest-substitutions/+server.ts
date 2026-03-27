import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';

const suggestSubstitutionsSchema = z.object({
  ingredient: z.string().min(1),
  context: z.string().optional(),
});

// POST /api/ai/suggest-substitutions - Suggest ingredient substitutions
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = suggestSubstitutionsSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { ingredient, context } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    const userPrompt = `Suggest 3-5 substitutions for "${ingredient}"${context ? ` in the context of: ${context}` : ''}.

Return a JSON array of objects with:
- substitution: string (the substitute ingredient)
- ratio: string (e.g., "1:1", "1 cup for every 2 cups")
- notes: string (optional tips for using the substitute)`;

    const generationResult = await aiService.generateForFeature(AIFeature.INGREDIENT_SUBSTITUTIONS, {
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = generationResult.content;

    let substitutions: Array<Record<string, unknown>>;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        substitutions = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
      } else {
        substitutions = [];
      }
    } catch {
      substitutions = [];
    }

    return json({ substitutions });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Suggest substitutions error:', e);
    throw error(500, 'Failed to suggest substitutions');
  }
};