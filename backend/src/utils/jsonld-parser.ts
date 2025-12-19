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
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value['@value']) return value['@value'];
  if (value.text) return extractText(value.text);
  if (value.name) return extractText(value.name);
  // For arrays, join them
  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join(' ');
  }
  // Don't return [object Object]
  if (typeof value === 'object') return '';
  return String(value);
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
 * Parse a single instruction item (HowToStep, HowToSection, or plain text)
 */
function parseInstructionItem(instruction: any): string[] {
  if (!instruction) return [];

  // Handle plain string
  if (typeof instruction === 'string') {
    return instruction.trim() ? [instruction.trim()] : [];
  }

  // Handle HowToSection - contains itemListElement with steps
  if (instruction['@type'] === 'HowToSection') {
    const sectionName = instruction.name ? `**${extractText(instruction.name)}**` : '';
    const steps = instruction.itemListElement || [];
    const parsedSteps = Array.isArray(steps)
      ? steps.flatMap(parseInstructionItem)
      : parseInstructionItem(steps);

    // Optionally prepend section name
    if (sectionName && parsedSteps.length > 0) {
      return [sectionName, ...parsedSteps];
    }
    return parsedSteps;
  }

  // Handle HowToStep format
  if (instruction['@type'] === 'HowToStep') {
    const text = extractText(instruction.text || instruction.name || instruction);
    return text.trim() ? [text.trim()] : [];
  }

  // Handle object with text property
  if (instruction.text) {
    const text = extractText(instruction.text);
    return text.trim() ? [text.trim()] : [];
  }

  // Handle object with name property
  if (instruction.name) {
    const text = extractText(instruction.name);
    return text.trim() ? [text.trim()] : [];
  }

  // Handle nested arrays
  if (Array.isArray(instruction)) {
    return instruction.flatMap(parseInstructionItem);
  }

  // Try to extract any text we can find
  const text = extractText(instruction);
  return text.trim() ? [text.trim()] : [];
}

/**
 * Parse instructions from various formats (HowToStep, HowToSection, or plain text)
 */
function parseInstructions(recipeData: any): string[] {
  const instructions = recipeData.recipeInstructions || [];

  if (Array.isArray(instructions)) {
    return instructions.flatMap(parseInstructionItem).filter(Boolean);
  }

  return parseInstructionItem(instructions).filter(Boolean);
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
 * Parse nutrition value from various formats (e.g., "200 calories", "15 g", "100mg")
 */
function parseNutritionValue(value: any): number | undefined {
  if (value === undefined || value === null) return undefined;

  // Handle NutritionInformation objects
  if (typeof value === 'object' && value['@type'] === 'NutritionInformation') {
    return undefined; // This is the parent object, not a value
  }

  const text = extractText(value);
  if (!text) return undefined;

  // Extract numeric value from strings like "200 calories", "15 g", "100mg"
  const match = text.match(/^([\d.]+)/);
  if (match) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? undefined : num;
  }

  return undefined;
}

/**
 * Parse nutrition information from Schema.org NutritionInformation
 */
function parseNutrition(recipeData: any): {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  saturatedFat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  cholesterol?: number;
} | undefined {
  const nutrition = recipeData.nutrition;
  if (!nutrition) return undefined;

  // Handle if nutrition is a string (sometimes it's just a description)
  if (typeof nutrition === 'string') return undefined;

  const result: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    saturatedFat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    cholesterol?: number;
  } = {};

  // Parse each nutrition field
  const calories = parseNutritionValue(nutrition.calories);
  if (calories !== undefined) result.calories = calories;

  const protein = parseNutritionValue(nutrition.proteinContent);
  if (protein !== undefined) result.protein = protein;

  const carbs = parseNutritionValue(nutrition.carbohydrateContent);
  if (carbs !== undefined) result.carbohydrates = carbs;

  const fat = parseNutritionValue(nutrition.fatContent);
  if (fat !== undefined) result.fat = fat;

  const saturatedFat = parseNutritionValue(nutrition.saturatedFatContent);
  if (saturatedFat !== undefined) result.saturatedFat = saturatedFat;

  const fiber = parseNutritionValue(nutrition.fiberContent);
  if (fiber !== undefined) result.fiber = fiber;

  const sugar = parseNutritionValue(nutrition.sugarContent);
  if (sugar !== undefined) result.sugar = sugar;

  const sodium = parseNutritionValue(nutrition.sodiumContent);
  if (sodium !== undefined) result.sodium = sodium;

  const cholesterol = parseNutritionValue(nutrition.cholesterolContent);
  if (cholesterol !== undefined) result.cholesterol = cholesterol;

  // Return undefined if no nutrition values were found
  if (Object.keys(result).length === 0) return undefined;

  return result;
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
  nutrition?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    saturatedFat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    cholesterol?: number;
  };
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

    // Parse nutrition information
    const nutrition = parseNutrition(recipeData);

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
      nutrition,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse Recipe JSONLD: ${error.message}`);
    }
    throw new Error('Failed to parse Recipe JSONLD: Unknown error');
  }
}
