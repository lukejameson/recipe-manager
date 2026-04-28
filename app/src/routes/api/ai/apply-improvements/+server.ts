import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { AIConfigurationError, isAIConfigurationError, AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';

const applyImprovementsSchema = z.object({
  recipe: z.object({
    title: z.string(),
    description: z.string().optional(),
    ingredients: z.array(z.string()),
    instructions: z.array(z.string()),
    prepTime: z.number().optional(),
    cookTime: z.number().optional(),
    servings: z.number().optional(),
  }),
  improvements: z.array(z.string()),
});

// POST /api/ai/apply-improvements - Apply improvements to a recipe using AI
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = applyImprovementsSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { recipe, improvements } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    const userPrompt = `Apply these improvements to the recipe and return the updated version:

IMPROVEMENTS TO APPLY:
${improvements.join('\n')}

ORIGINAL RECIPE:
Title: ${recipe.title}
Description: ${recipe.description || 'N/A'}
Prep Time: ${recipe.prepTime || 'N/A'} min
Cook Time: ${recipe.cookTime || 'N/A'} min
Servings: ${recipe.servings || 'N/A'}

Ingredients:
${recipe.ingredients.join('\n')}

Instructions:
${recipe.instructions.join('\n')}

Return ONLY a JSON object with the updated recipe fields.`;

    const generationResult = await aiService.generateForFeature(AIFeature.APPLY_IMPROVEMENTS, {
      messages: [{ role: 'user', content: userPrompt }],
      jsonMode: true,
    });

    const content = generationResult.content;

    let updatedRecipe: Record<string, unknown>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        updatedRecipe = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      throw error(500, 'Failed to parse updated recipe');
    }

    return json(updatedRecipe);
  } catch (e) {
    if ('status' in e) throw e;
    if (isAIRateLimitError(e)) {
      throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
    }
    if (isAIConfigurationError(e)) {
      throw error(503, e.message);
    }
    console.error('Apply improvements error:', e);
    throw error(500, 'Failed to apply improvements');
  }
};
