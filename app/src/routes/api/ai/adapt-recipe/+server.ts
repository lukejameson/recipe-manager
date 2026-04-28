import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { PromptService } from '$lib/server/ai/prompt-service';
import { AIConfigurationError, isAIConfigurationError, AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';

const adaptRecipeSchema = z.object({
  recipe: z.object({
    title: z.string(),
    description: z.string().optional(),
    ingredients: z.array(z.string()),
    instructions: z.array(z.string()),
    prepTime: z.number().optional(),
    cookTime: z.number().optional(),
    servings: z.number().optional(),
  }),
  adaptationType: z.enum(['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'keto', 'low-carb', 'quick', 'meal-prep', 'air-fryer', 'instant-pot', 'kids-friendly']),
});

// POST /api/ai/adapt-recipe - Adapt a recipe for dietary needs or cooking methods
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = adaptRecipeSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { recipe, adaptationType } = result.data;
    const aiService = await AIServiceV2.getInstance();
    const promptData = await PromptService.getPrompt(AIFeature.RECIPE_ADAPTATION);
    let systemPrompt = promptData?.content || `Adapt this recipe for: {{adaptation_type}}
Recipe: {{recipe_title}}
Dietary restrictions: {{dietary_restrictions}}
Maintain the essence and flavor of the original recipe while accommodating the dietary requirements.
Return the adapted recipe in JSON format.`;
    const dietaryRestrictions = {
      'vegan': 'fully vegan, no animal products',
      'vegetarian': 'vegetarian, no meat but dairy and eggs allowed',
      'gluten-free': 'gluten-free, no wheat or gluten',
      'dairy-free': 'dairy-free, no milk products',
      'keto': 'keto, low carb high fat',
      'low-carb': 'low-carb',
      'quick': 'quick version, under 30 minutes',
      'meal-prep': 'meal prep friendly, freezer friendly',
      'air-fryer': 'air fryer compatible',
      'instant-pot': 'Instant Pot compatible',
      'kids-friendly': 'kid-friendly, mild flavors'
    };
    systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
      adaptation_type: adaptationType,
      recipe_title: recipe.title,
      dietary_restrictions: dietaryRestrictions[adaptationType] || adaptationType
    });
    const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_ADAPTATION, {
      systemPrompt,
      messages: [{ role: 'user', content: `Please adapt this recipe for ${adaptationType}.` }],
      jsonMode: true,
    });

    const content = generationResult.content;

    let adaptedRecipe: Record<string, unknown>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        adaptedRecipe = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      throw error(500, 'Failed to parse adapted recipe');
    }

    return json(adaptedRecipe);
  } catch (e) {
    if ('status' in e) throw e;
    if (isAIRateLimitError(e)) {
      throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
    }
    if (isAIConfigurationError(e)) {
      throw error(503, e.message);
    }
    console.error('Adapt recipe error:', e);
    throw error(500, 'Failed to adapt recipe');
  }
};