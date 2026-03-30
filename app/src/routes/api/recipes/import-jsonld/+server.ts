import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const importJsonLdSchema = z.object({
  jsonld: z.string().min(1),
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
      ingredients: stringsToItemList(parseIngredients(recipeData.recipeIngredient || [])),
      instructions: stringsToItemList(parseInstructions(recipeData.recipeInstructions || [])),
      prepTime: parseDuration(recipeData.prepTime),
      cookTime: parseDuration(recipeData.cookTime),
      totalTime: parseDuration(recipeData.totalTime),
      servings: parseServings(recipeData.recipeYield),
      imageUrl: extractImageUrl(recipeData.image),
      nutrition: parseNutrition(recipeData.nutrition),
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

function parseServings(yieldStr: string | string[] | number | undefined): number | undefined {
  if (!yieldStr) return undefined;

  // Handle number directly
  if (typeof yieldStr === 'number') {
    return yieldStr;
  }

  const str = Array.isArray(yieldStr) ? yieldStr[0] : yieldStr;

  // Ensure we have a string before calling match
  if (typeof str !== 'string') {
    return undefined;
  }

  // Match decimal numbers (e.g., "0.5", "2.5", "4")
  const match = str.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : undefined;
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

/**
 * Parse nutrition information from schema.org NutritionInformation
 * Maps schema.org fields to our NutritionInfo format
 */
function parseNutrition(nutrition: any): import('$lib/server/db/schema').NutritionInfo | undefined {
  if (!nutrition) return undefined;

  // Handle array (take first)
  const n = Array.isArray(nutrition) ? nutrition[0] : nutrition;

  // Must have @type of NutritionInformation or similar
  if (n['@type'] && !n['@type'].includes('NutritionInformation')) {
    return undefined;
  }

  // Helper to parse numeric values from schema.org quantities
  const parseValue = (val: any): number | undefined => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // Extract number from strings like "300 calories" or "15g"
      const match = val.match(/([\d.]+)/);
      return match ? parseFloat(match[1]) : undefined;
    }
    return undefined;
  };

  return {
    calories: parseValue(n.calories),
    protein: parseValue(n.proteinContent),
    carbohydrates: parseValue(n.carbohydrateContent),
    fat: parseValue(n.fatContent),
    saturatedFat: parseValue(n.saturatedFatContent),
    fiber: parseValue(n.fiberContent),
    sugar: parseValue(n.sugarContent),
    sodium: parseValue(n.sodiumContent),
    cholesterol: parseValue(n.cholesterolContent),
  };
}
