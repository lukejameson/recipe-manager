import { aiService } from './index.js';
import type { NutritionInfo } from '../../db/schema.js';

export interface NutritionCalculationInput {
  ingredients: string[];
  servings: number;
  title?: string;
}

const NUTRITION_SYSTEM_PROMPT = `You are a nutrition expert and registered dietitian. Given a list of recipe ingredients and serving count, calculate the approximate nutritional information per serving.

Your task:
1. Analyze each ingredient, estimating quantities from the descriptions
2. Calculate total nutritional values for the entire recipe
3. Divide by the number of servings to get per-serving values

Return ONLY a valid JSON object with the following optional fields (only include fields you can reasonably estimate):
{
  "calories": number (kcal),
  "protein": number (grams),
  "carbohydrates": number (grams),
  "fat": number (grams),
  "saturatedFat": number (grams),
  "fiber": number (grams),
  "sugar": number (grams),
  "sodium": number (milligrams),
  "cholesterol": number (milligrams)
}

Guidelines:
- Be conservative and realistic in your estimates
- If an ingredient quantity is unclear, use a typical amount
- If you cannot reasonably estimate a value, omit that field entirely
- Round all values to one decimal place
- Return ONLY the JSON object, no other text or explanation`;

/**
 * Calculate nutrition information for a recipe using AI.
 * @param input - The recipe ingredients, servings, and optional title
 * @returns Estimated nutrition information per serving
 */
export async function calculateNutrition(
  input: NutritionCalculationInput
): Promise<NutritionInfo> {
  const userPrompt = `Calculate nutrition per serving for the following recipe:

Recipe: ${input.title || 'Untitled Recipe'}
Total Servings: ${input.servings}

Ingredients:
${input.ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Please analyze these ingredients and return the nutritional values per serving as JSON.`;

  const result = await aiService.complete({
    systemPrompt: NUTRITION_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 512,
    temperature: 0.2, // Low temperature for more consistent results
  });

  // Parse and validate the JSON response
  try {
    let jsonStr = result.content.trim();

    // Handle potential markdown code blocks
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const nutrition = JSON.parse(jsonStr);

    // Validate and sanitize the response
    const sanitized: NutritionInfo = {};
    const validFields: (keyof NutritionInfo)[] = [
      'calories',
      'protein',
      'carbohydrates',
      'fat',
      'saturatedFat',
      'fiber',
      'sugar',
      'sodium',
      'cholesterol',
    ];

    for (const field of validFields) {
      const value = nutrition[field];
      if (typeof value === 'number' && value >= 0 && isFinite(value)) {
        // Round to one decimal place
        sanitized[field] = Math.round(value * 10) / 10;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      throw new Error('AI response did not contain any valid nutrition values');
    }

    return sanitized;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        'Failed to parse nutrition data from AI response. The response was not valid JSON.'
      );
    }
    throw error;
  }
}
