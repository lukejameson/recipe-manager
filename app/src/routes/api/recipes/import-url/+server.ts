import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const importUrlSchema = z.object({
  url: z.string().url(),
  convertToMetric: z.boolean().optional(),
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

// POST /api/recipes/import-url - Import recipe from URL
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = importUrlSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { url, convertToMetric } = result.data;

    // Fetch the URL content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
      },
    });

    if (!response.ok) {
      throw error(400, 'Failed to fetch URL');
    }

    const html = await response.text();

    // Extract JSON-LD structured data
    // Flexible regex to handle different attribute orderings and formats
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);


    if (!jsonLdMatch) {
      throw error(400, 'No structured recipe data found on this page');
    }

    let recipeData: any = null;

    for (const match of jsonLdMatch) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        let data = JSON.parse(jsonContent);

        // Handle JSON-LD that's an array of objects (e.g., [{...}, {...}])
        if (Array.isArray(data)) {
          const recipe = data.find((item: any) => isRecipeType(item['@type']));
          if (recipe) {
            recipeData = recipe;
            break;
          }
        }

        // Handle @graph format (multiple items)
        if (data['@graph'] && Array.isArray(data['@graph'])) {
          const recipe = data['@graph'].find((item: any) => isRecipeType(item['@type']));
          if (recipe) {
            recipeData = recipe;
            break;
          }
        }

        // Handle direct Recipe type
        if (isRecipeType(data['@type'])) {
          recipeData = data;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!recipeData) {
      throw error(400, 'No recipe data found on this page');
    }

    // Parse recipe data
    const recipe = {
      title: recipeData.name || 'Untitled Recipe',
      description: recipeData.description || '',
      ingredients: stringsToItemList(parseIngredients(recipeData.recipeIngredient || [])),
      instructions: stringsToItemList(parseInstructions(recipeData.recipeInstructions || [])),
      prepTime: parseDuration(recipeData.prepTime),
      cookTime: parseDuration(recipeData.cookTime),
      nutrition: parseNutrition(recipeData.nutrition),
      totalTime: parseDuration(recipeData.totalTime),
      servings: parseServings(recipeData.recipeYield),
      imageUrl: extractImageUrl(recipeData.image),
      sourceUrl: url,
    };

    return json(recipe);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Import from URL error:', e);
    throw error(500, 'Failed to import recipe');
  }
};

/**
 * Check if a type value represents a Recipe
 * Handles variations like 'Recipe', 'https://schema.org/Recipe', etc.
 */
function isRecipeType(typeValue: any): boolean {
  if (typeof typeValue === 'string') {
    // Direct Recipe type or schema.org URL
    return typeValue === 'Recipe' ||
           typeValue.endsWith('Recipe') ||
           /^https?:\/\/schema\.org\/Recipe$/i.test(typeValue);
  }
  if (Array.isArray(typeValue)) {
    return typeValue.some(isRecipeType);
  }
  return false;
}

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
        // Handle HowToSection
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

  // Parse ISO 8601 duration (PT1H30M)
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
