import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { AIConfigurationError, isAIConfigurationError } from '$lib/utils/errors';

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

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    const adaptationPrompts: Record<string, string> = {
      'vegan': 'Convert this recipe to be fully vegan. Replace all animal products with plant-based alternatives.',
      'vegetarian': 'Convert this recipe to be vegetarian. Remove meat but keep dairy and eggs.',
      'gluten-free': 'Make this recipe gluten-free. Replace wheat and gluten-containing ingredients.',
      'dairy-free': 'Make this recipe dairy-free. Replace milk, butter, cheese with alternatives.',
      'keto': 'Adapt this recipe for a keto diet. Reduce carbs significantly, increase healthy fats.',
      'low-carb': 'Reduce carbohydrates in this recipe while keeping it flavorful.',
      'quick': 'Create a quick 30-minute version of this recipe with shortcuts.',
      'meal-prep': 'Adapt this recipe for meal prep - make it freezer-friendly or good for reheating.',
      'air-fryer': 'Convert this recipe for air fryer cooking with adjusted times and temperatures.',
      'instant-pot': 'Convert this recipe for Instant Pot pressure cooking.',
      'kids-friendly': 'Make this recipe kid-friendly with milder flavors and simple ingredients.',
    };

    const userPrompt = `${adaptationPrompts[adaptationType]}

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

Return a JSON object with the adapted recipe fields.`;

    const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_ADAPTATION, {
      messages: [{ role: 'user', content: userPrompt }],
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
    if (isAIConfigurationError(e)) {
      throw error(503, e.message);
    }
    console.error('Adapt recipe error:', e);
    throw error(500, 'Failed to adapt recipe');
  }
};