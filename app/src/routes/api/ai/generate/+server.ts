import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { randomUUID } from 'crypto';

const generateSchema = z.object({
  prompt: z.string().min(1),
  dietaryRestrictions: z.array(z.string()).optional(),
  cuisine: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  maxTime: z.number().optional(),
});

interface RecipeItem {
  id: string;
  text: string;
  order: number;
  checked?: boolean;
}

function stringsToItemList(strings: string[]): { items: RecipeItem[] } {
  return {
    items: strings
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map((text, i) => ({
        id: randomUUID(),
        text,
        order: i
      }))
  };
}

// POST /api/ai/generate - Generate a recipe from prompt
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = generateSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { prompt, dietaryRestrictions, cuisine, difficulty, maxTime } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    // Build the prompt for recipe generation
    const systemPrompt = `You are a recipe creator. Create a complete, detailed recipe based on the user's request.

Your response MUST be a valid JSON object with these exact fields:
{
  "title": "string - Recipe name",
  "description": "string - Brief description of the dish",
  "ingredients": ["array of ingredient strings with quantities, e.g., '2 cups flour'"],
  "instructions": ["array of step-by-step instructions"],
  "prepTime": number (minutes, optional),
  "cookTime": number (minutes, optional),
  "servings": number (optional),
  "tags": ["array of relevant tags like 'dinner', 'vegetarian', 'quick'"]
}

Important:
- Return ONLY the JSON object, no markdown formatting, no backticks
- Ensure all JSON is valid (no trailing commas)
- Ingredients should include specific quantities
- Instructions should be clear and numbered logically`;

    let userPrompt = `Create a recipe for: ${prompt}`;

    if (dietaryRestrictions?.length) {
      userPrompt += `\n\nDietary restrictions: ${dietaryRestrictions.join(', ')}`;
    }
    if (cuisine) {
      userPrompt += `\n\nCuisine style: ${cuisine}`;
    }
    if (difficulty) {
      userPrompt += `\n\nDifficulty level: ${difficulty}`;
    }
    if (maxTime) {
      userPrompt += `\n\nMaximum total time: ${maxTime} minutes`;
    }

    // Use AIServiceV2 for generation
    const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_GENERATION, {
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      jsonMode: true,
    });

    const content = generationResult.content;

    // Parse the JSON response
    let recipeData: Record<string, unknown>;
    try {
      // Try to extract JSON from the response (in case there's any extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recipeData = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } else {
        recipeData = JSON.parse(content) as Record<string, unknown>;
      }
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw error(500, 'Failed to parse generated recipe');
    }

    // Validate required fields
    if (!recipeData.title || !Array.isArray(recipeData.ingredients) || !Array.isArray(recipeData.instructions)) {
      console.error('Invalid recipe structure:', recipeData);
      throw error(500, 'Generated recipe has invalid structure');
    }

    return json({
      recipe: {
        title: String(recipeData.title),
        description: String(recipeData.description || ''),
        ingredients: stringsToItemList(recipeData.ingredients as string[]),
        instructions: stringsToItemList(recipeData.instructions as string[]),
        prepTime: typeof recipeData.prepTime === 'number' ? recipeData.prepTime : undefined,
        cookTime: typeof recipeData.cookTime === 'number' ? recipeData.cookTime : undefined,
        servings: typeof recipeData.servings === 'number' ? recipeData.servings : undefined,
        tags: Array.isArray(recipeData.tags) ? recipeData.tags as string[] : [],
      },
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('AI generate error:', e);
    throw error(500, 'Failed to generate recipe');
  }
};
