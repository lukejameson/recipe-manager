import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { AIConfigurationError, isAIConfigurationError, AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';

const suggestImprovementsSchema = z.object({
  recipe: z.object({
    title: z.string(),
    description: z.string().optional(),
    ingredients: z.array(z.string()),
    instructions: z.array(z.string()),
  }),
});

// POST /api/ai/suggest-improvements - Suggest improvements for a recipe
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = suggestImprovementsSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { recipe } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    const userPrompt = `Analyze this recipe and suggest 2-4 improvements or variations.

Recipe: ${recipe.title}
Description: ${recipe.description || 'N/A'}
Ingredients: ${recipe.ingredients.join('\n')}
Instructions: ${recipe.instructions.join('\n')}

Return a JSON array of suggestions, each with:
- category: string (e.g., "Flavor", "Technique", "Ingredient", "Presentation")
- suggestion: string (the improvement idea)
- explanation: string (why this helps)
- priority: "high" | "medium" | "low"`;

    const generationResult = await aiService.generateForFeature(AIFeature.IMPROVEMENT_SUGGESTIONS, {
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = generationResult.content;

    let suggestions: Array<Record<string, unknown>>;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
      } else {
        suggestions = [];
      }
    } catch {
      suggestions = [];
    }

    return json({ suggestions });
  } catch (e) {
    if ('status' in e) throw e;
    if (isAIRateLimitError(e)) {
      throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
    }
    if (isAIConfigurationError(e)) {
      throw error(503, e.message);
    }
    console.error('Suggest improvements error:', e);
    throw error(500, 'Failed to suggest improvements');
  }
};