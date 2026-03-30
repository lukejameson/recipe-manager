import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { randomUUID } from 'crypto';

const extractPhotosSchema = z.object({
  images: z.array(z.string()),
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

function parseStructuredItems(items: any[]): { items: RecipeItem[] } {
  if (!Array.isArray(items)) return { items: [] };

  return {
    items: items.map((item, i) => ({
      id: item.id || randomUUID(),
      text: typeof item === 'string' ? item : item.text,
      order: item.order ?? i
    }))
  };
}

// POST /api/recipes/extract-from-photos - Extract recipe data from photos using AI
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = extractPhotosSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { images } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    // Convert base64 images to ImageData format
    const imageData = images.map(img => {
      const isPng = img.startsWith('data:image/png');
      const base64Data = img.split(',')[1];
      return {
        mimeType: isPng ? 'image/png' : 'image/jpeg',
        data: base64Data
      };
    });

    const systemPrompt = `Extract recipe information from these images. Return a JSON object with:
- title: string
- description: string (optional)
- ingredients: array of objects with id (optional UUID), text (string), and order (optional number) - OR array of strings
- instructions: array of objects with id (optional UUID), text (string), and order (optional number) - OR array of strings
- prepTime: number (minutes, optional)
- cookTime: number (minutes, optional)
- servings: number (optional)
- notes: string (optional)

For ingredients and instructions, you can return either:
1. Simple string arrays: ["2 cups flour", "1 cup sugar"]
2. Structured objects: [{"id": "uuid", "text": "2 cups flour", "order": 0}]

Only include fields you can confidently extract from the images.`;

    // Process images with AIServiceV2 using vision
    const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_FROM_PHOTOS, {
      systemPrompt,
      messages: [{ role: 'user', content: 'Extract the recipe from these images.' }],
      images: imageData,
      jsonMode: true,
    });

    const content = generationResult.content;

    // Extract JSON from response
    let recipeData: Record<string, unknown>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recipeData = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      console.error('Failed to parse AI response:', content);
      throw error(500, 'Failed to parse recipe data from images');
    }

    // Transform ingredients and instructions to structured format if needed
    const processedData: Record<string, unknown> = { ...recipeData };

    if (recipeData.ingredients) {
      if (Array.isArray(recipeData.ingredients) && recipeData.ingredients.length > 0) {
        const firstItem = recipeData.ingredients[0];
        if (typeof firstItem === 'string') {
          // Convert string array to structured format
          processedData.ingredients = stringsToItemList(recipeData.ingredients as string[]);
        } else {
          // Already structured or mixed - use parseStructuredItems
          processedData.ingredients = parseStructuredItems(recipeData.ingredients as any[]);
        }
      } else {
        processedData.ingredients = { items: [] };
      }
    }

    if (recipeData.instructions) {
      if (Array.isArray(recipeData.instructions) && recipeData.instructions.length > 0) {
        const firstItem = recipeData.instructions[0];
        if (typeof firstItem === 'string') {
          // Convert string array to structured format
          processedData.instructions = stringsToItemList(recipeData.instructions as string[]);
        } else {
          // Already structured or mixed - use parseStructuredItems
          processedData.instructions = parseStructuredItems(recipeData.instructions as any[]);
        }
      } else {
        processedData.instructions = { items: [] };
      }
    }

    return json({
      ...processedData,
      extracted: true,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Extract from photos error:', e);
    throw error(500, 'Failed to extract recipe from images');
  }
};
