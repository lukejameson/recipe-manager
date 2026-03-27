import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';

const importUrlSchema = z.object({
  url: z.string().url(),
  convertToMetric: z.boolean().optional(),
});

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
      throw error(400, `Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);

    if (!jsonLdMatch) {
      throw error(400, 'No structured recipe data found on this page');
    }

    let recipeData: any = null;

    for (const match of jsonLdMatch) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        const data = JSON.parse(jsonContent);

        // Handle @graph format (multiple items)
        if (data['@graph'] && Array.isArray(data['@graph'])) {
          const recipe = data['@graph'].find((item: any) =>
            item['@type'] === 'Recipe' ||
            (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
          );
          if (recipe) {
            recipeData = recipe;
            break;
          }
        }

        // Handle direct Recipe type
        if (data['@type'] === 'Recipe' ||
            (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))) {
          recipeData = data;
          break;
        }
      } catch (e) {
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
      ingredients: parseIngredients(recipeData.recipeIngredient || []),
      instructions: parseInstructions(recipeData.recipeInstructions || []),
      prepTime: parseDuration(recipeData.prepTime),
      cookTime: parseDuration(recipeData.cookTime),
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
