import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { PromptService } from '$lib/server/ai/prompt-service';
import { AIConfigurationError, isAIConfigurationError, AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';

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
    const aiService = await AIServiceV2.getInstance();
    const promptData = await PromptService.getPrompt(AIFeature.PANTRY_MATCHING);
    let systemPrompt = promptData?.content || `Find recipes that can be made with available pantry items.
Available pantry items: {{pantry_items}}
Recipe ingredients needed: {{recipe_ingredients}}
Calculate match score and identify:
- Which recipes can be made completely from pantry
- Which recipes are missing a few ingredients
- Best matches overall
Return a JSON array sorted by match score.`;
    const recipeIngredients = recipes.map(r => `${r.title}: ${r.ingredients.join(', ')}`).join('; ');
    systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
      pantry_items: availableIngredients.join(', '),
      recipe_ingredients: recipeIngredients
    });
    const generationResult = await aiService.generateForFeature(AIFeature.PANTRY_MATCHING, {
      systemPrompt,
      messages: [{ role: 'user', content: 'Please find matching recipes based on available ingredients.' }],
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
    if ('status' in e) throw e;
    if (isAIRateLimitError(e)) {
      throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
    }
    if (isAIConfigurationError(e)) {
      throw error(503, e.message);
    }
    console.error('Find matching recipes error:', e);
    throw error(500, 'Failed to find matching recipes');
  }
};