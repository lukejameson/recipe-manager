/**
 * Parse ISO 8601 duration format (e.g., "PT30M", "PT1H30M") to minutes
 */
function parseDuration(duration: string): number | null {
  if (!duration) return null;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);

  return hours * 60 + minutes;
}

/**
 * Extract text from various JSONLD text formats
 */
function extractText(value: any): string {
  if (typeof value === 'string') return value;
  if (value?.['@value']) return value['@value'];
  if (value?.text) return value.text;
  return String(value || '');
}

/**
 * Parse ingredients from various formats
 */
function parseIngredients(recipeData: any): string[] {
  const ingredients = recipeData.recipeIngredient || [];

  if (Array.isArray(ingredients)) {
    return ingredients.map(extractText).filter(Boolean);
  }

  return [extractText(ingredients)].filter(Boolean);
}

/**
 * Parse instructions from various formats (HowToStep or plain text)
 */
function parseInstructions(recipeData: any): string[] {
  const instructions = recipeData.recipeInstructions || [];

  if (Array.isArray(instructions)) {
    return instructions
      .map((instruction) => {
        // Handle HowToStep format
        if (instruction['@type'] === 'HowToStep') {
          return extractText(instruction.text);
        }
        // Handle plain text
        return extractText(instruction);
      })
      .filter(Boolean);
  }

  // Single instruction
  if (instructions['@type'] === 'HowToStep') {
    return [extractText(instructions.text)].filter(Boolean);
  }

  return [extractText(instructions)].filter(Boolean);
}

/**
 * Extract image URL from various formats
 */
function extractImageUrl(image: any): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (image.url) return extractText(image.url);
  if (Array.isArray(image) && image.length > 0) {
    return extractImageUrl(image[0]);
  }
  return undefined;
}

/**
 * Parse Schema.org/Recipe JSONLD and convert to RecipeInput format
 */
export function parseRecipeJsonLd(jsonldString: string): {
  title: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  servings?: number;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
  sourceUrl?: string;
  tags: string[];
} {
  try {
    const data = JSON.parse(jsonldString);

    // Handle if it's wrapped in a @graph or multiple recipes
    let recipeData = data;
    if (data['@graph']) {
      recipeData = data['@graph'].find((item: any) => item['@type'] === 'Recipe');
    }
    if (Array.isArray(data)) {
      recipeData = data.find((item: any) => item['@type'] === 'Recipe');
    }

    if (!recipeData || recipeData['@type'] !== 'Recipe') {
      throw new Error('Invalid Recipe JSONLD: @type must be "Recipe"');
    }

    // Extract basic fields
    const title = extractText(recipeData.name);
    if (!title) {
      throw new Error('Recipe must have a name');
    }

    const description = recipeData.description
      ? extractText(recipeData.description)
      : undefined;

    // Parse time durations
    const prepTime = parseDuration(recipeData.prepTime);
    const cookTime = parseDuration(recipeData.cookTime);
    const totalTime = parseDuration(recipeData.totalTime);

    // Parse servings/yield
    let servings: number | undefined;
    if (recipeData.recipeYield) {
      const yieldValue = extractText(recipeData.recipeYield);
      const parsed = parseInt(yieldValue, 10);
      if (!isNaN(parsed)) {
        servings = parsed;
      }
    }

    // Parse ingredients and instructions
    const ingredients = parseIngredients(recipeData);
    const instructions = parseInstructions(recipeData);

    if (ingredients.length === 0) {
      throw new Error('Recipe must have at least one ingredient');
    }
    if (instructions.length === 0) {
      throw new Error('Recipe must have at least one instruction');
    }

    // Extract image and source URL
    const imageUrl = extractImageUrl(recipeData.image);
    const sourceUrl = recipeData.url ? extractText(recipeData.url) : undefined;

    // Extract tags from recipeCategory or keywords
    const tags: string[] = [];
    if (recipeData.recipeCategory) {
      const categories = Array.isArray(recipeData.recipeCategory)
        ? recipeData.recipeCategory
        : [recipeData.recipeCategory];
      tags.push(...categories.map(extractText).filter(Boolean));
    }
    if (recipeData.keywords) {
      const keywords = extractText(recipeData.keywords);
      // Split by comma if it's a comma-separated string
      if (keywords.includes(',')) {
        tags.push(...keywords.split(',').map((k: string) => k.trim()).filter(Boolean));
      } else {
        tags.push(keywords);
      }
    }

    return {
      title,
      description,
      prepTime: prepTime ?? undefined,
      cookTime: cookTime ?? undefined,
      totalTime: totalTime ?? undefined,
      servings,
      ingredients,
      instructions,
      imageUrl,
      sourceUrl,
      tags: [...new Set(tags)], // Remove duplicates
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse Recipe JSONLD: ${error.message}`);
    }
    throw new Error('Failed to parse Recipe JSONLD: Unknown error');
  }
}
