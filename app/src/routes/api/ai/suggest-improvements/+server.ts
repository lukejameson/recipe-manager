import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { PromptService } from '$lib/server/ai/prompt-service';
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
    const aiService = await AIServiceV2.getInstance();
    const promptData = await PromptService.getPrompt(AIFeature.IMPROVEMENT_SUGGESTIONS);
    let systemPrompt = promptData?.content || `Analyze this recipe and suggest improvements:
Recipe: {{recipe_title}}
Ingredients: {{ingredients}}
Instructions: {{instructions}}
Consider:
- Flavor enhancements
- Technique improvements
- Ingredient substitutions for better results
- Cooking time optimizations
- Plating and presentation suggestions
Return a JSON array of improvement objects:
[
  {
    "category": "flavor/technique/substitution/timing/presentation",
    "suggestion": "specific suggestion",
    "explanation": "why this improves the recipe"
  }
]`;
    systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
      recipe_title: recipe.title,
      ingredients: recipe.ingredients.join(', '),
      instructions: recipe.instructions.join('; ')
    });
    const generationResult = await aiService.generateForFeature(AIFeature.IMPROVEMENT_SUGGESTIONS, {
      systemPrompt,
      messages: [{ role: 'user', content: 'Please suggest improvements for this recipe.' }],
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