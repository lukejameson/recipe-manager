import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';

const findMatchingSchema = z.object({
  availableIngredients: z.array(z.string()).min(1),
  recipes: z.array(z.object({
    id: z.string(),
    title: z.string(),
    ingredients: z.array(z.string()),
  })),
});

// POST /api/ai/find-matching-recipes - Find recipes that can be made with available ingredients
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = findMatchingSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { availableIngredients, recipes } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    const userPrompt = `I have these ingredients: ${availableIngredients.join(', ')}

Match them against these recipes and return a JSON array of matches with:
- recipeId: string
- matchScore: number (0-100 percentage)
- matchedIngredients: array of matched ingredient names
- missingIngredients: array of missing ingredient names

RECIPES:
${recipes.map(r => `ID: ${r.id}\nTitle: ${r.title}\nIngredients: ${r.ingredients.join(', ')}`).join('\n\n')}`;

    const generationResult = await aiService.generateForFeature(AIFeature.PANTRY_MATCHING, {
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = generationResult.content;

    let matches: Array<Record<string, unknown>>;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        matches = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
      } else {
        matches = [];
      }
    } catch {
      matches = [];
    }

    return json(matches);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Find matching recipes error:', e);
    throw error(500, 'Failed to find matching recipes');
  }
};