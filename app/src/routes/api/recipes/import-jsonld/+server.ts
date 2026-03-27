import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';

const importJsonLdSchema = z.object({
  jsonld: z.string().min(1),
});

// POST /api/recipes/import-jsonld - Import recipe from JSON-LD string
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = importJsonLdSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { jsonld } = result.data;

    let recipeData: any;
    try {
      recipeData = JSON.parse(jsonld);
    } catch (e) {
      throw error(400, 'Invalid JSON-LD format');
    }

    // Handle @graph format
    if (recipeData['@graph'] && Array.isArray(recipeData['@graph'])) {
      const recipe = recipeData['@graph'].find((item: any) =>
        item['@type'] === 'Recipe' ||
        (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
      );
      if (recipe) {
        recipeData = recipe;
      }
    }

    // Validate it's a Recipe type
    if (!(recipeData['@type'] === 'Recipe' ||
          (Array.isArray(recipeData['@type']) && recipeData['@type'].includes('Recipe')))) {
      throw error(400, 'Provided JSON-LD is not a Recipe');
    }

    // Parse recipe data
    const recipe = {
      title: recipeData.name || 'Untitled Recipe',
      description: recipeData.description || '',
      ingredients: parseIngredients(recipeData.recipeIngredient || []),
      instructions: parseInstructions(recipeData.recipeInstructions || []),
      prepTime: parseDuration(recipeData.prepTime),
      cookTime: parseDuration(recipeData.cookTime),
      totalTime: parseDuration(recipeData.totalTime),
      servings: parseServings(recipeData.recipeYield),
      imageUrl: extractImageUrl(recipeData.image),
    };

    return json(recipe);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Import JSON-LD error:', e);
    throw error(500, 'Failed to import recipe');
  }
};

function parseIngredients(ingredients: string[] | string): string[] {
  if (typeof ingredients === 'string') {
    return ingredients.split('\n').filter(i => i.trim());
  }
  return ingredients.filter(i => i.trim());
}

function parseInstructions(instructions: any): string[] {
  if (typeof instructions === 'string') {
    return instructions.split('\n').filter(i => i.trim());
  }

  if (Array.isArray(instructions)) {
    return instructions.map((step: any) => {
      if (typeof step === 'string') return step;
      if (step.text) return step.text;
      if (step.name && step.itemListElement) {
        const sectionSteps = step.itemListElement.map((s: any) =>
          typeof s === 'string' ? s : s.text || ''
        ).filter(Boolean);
        return `${step.name}:\n${sectionSteps.join('\n')}`;
      }
      return '';
    }).filter(Boolean);
  }

  return [];
}

function parseDuration(duration: string | undefined): number | undefined {
  if (!duration) return undefined;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (match) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    return hours * 60 + minutes;
  }

  return undefined;
}

function parseServings(yieldStr: string | string[] | undefined): number | undefined {
  if (!yieldStr) return undefined;

  const str = Array.isArray(yieldStr) ? yieldStr[0] : yieldStr;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

function extractImageUrl(image: any): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (image.url) return image.url;
  if (Array.isArray(image)) {
    const first = image[0];
    return typeof first === 'string' ? first : first?.url;
  }
  return undefined;
}
