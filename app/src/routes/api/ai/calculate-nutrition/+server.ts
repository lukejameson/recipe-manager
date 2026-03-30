import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';

const nutritionSchema = z.object({
  ingredients: z.array(z.string()).min(1),
  servings: z.number().min(1),
  title: z.string().optional(),
});

const parsedNutritionSchema = z.object({
  calories: z.number().positive(),
  protein: z.number().nonnegative(),
  carbohydrates: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  saturatedFat: z.number().nonnegative().optional(),
  fiber: z.number().nonnegative().optional(),
  sugar: z.number().nonnegative().optional(),
  sodium: z.number().nonnegative().optional(),
  cholesterol: z.number().nonnegative().optional(),
});

interface NutritionResult {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  saturatedFat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  cholesterol?: number;
}

function isNutritionDataReasonable(data: NutritionResult): boolean {
  const { calories, protein, carbohydrates, fat } = data;
  if (calories <= 0 || calories > 5000) return false;
  if (protein < 0 || protein > 200) return false;
  if (carbohydrates < 0 || carbohydrates > 1000) return false;
  if (fat < 0 || fat > 500) return false;

  const estimatedCalories = protein * 4 + carbohydrates * 4 + fat * 9;
  const tolerance = 0.5;
  const minExpected = estimatedCalories * (1 - tolerance);
  const maxExpected = estimatedCalories * (1 + tolerance);

  if (data.sodium !== undefined && (data.sodium < 0 || data.sodium > 10000)) return false;
  if (data.cholesterol !== undefined && (data.cholesterol < 0 || data.cholesterol > 2000)) return false;

  if (estimatedCalories > 50) {
    if (calories < minExpected || calories > maxExpected) {
      console.warn(`Calorie sanity check failed: estimated=${estimatedCalories.toFixed(0)}, actual=${calories}`);
      return false;
    }
  }
  return true;
}

function extractJSONFromResponse(content: string): unknown {
  console.debug('Attempting to extract JSON from response:', content.substring(0, Math.min(200, content.length)));

  // Strategy 1: Look for code blocks with JSON language tag
  const codeBlockMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const codeContent = codeBlockMatch[1].trim();
    console.debug('Found JSON code block, attempting to parse...');
    try {
      const parsed = JSON.parse(codeContent);
      console.debug('Successfully parsed JSON from code block');
      return parsed;
    } catch (e) {
      console.debug('Code block JSON parsing failed, will treat as plain text later:', e);
      // Return the code content as a string to potentially extract key-values via regex later
      // But we don't throw yet - try other strategies first
      // We'll remember that code block existed
    }
  }

  // Strategy 2: Find balanced braces (complete JSON object)
  const firstBrace = content.indexOf('{');
  if (firstBrace !== -1) {
    let braceCount = 0;
    for (let i = firstBrace; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0) {
        const jsonStr = content.substring(firstBrace, i + 1);
        try {
          const parsed = JSON.parse(jsonStr);
          console.debug('Successfully parsed JSON using balanced braces');
          return parsed;
        } catch (e) {
          console.debug('Balanced braces JSON parsing failed:', e);
        }
        break;
      }
    }
  }

  // Strategy 3: Greedy match for any {...} pattern
  const greedyMatch = content.match(/\{[\s\S]*\}/);
  if (greedyMatch) {
    try {
      const parsed = JSON.parse(greedyMatch[0]);
      console.debug('Successfully parsed JSON using greedy match');
      return parsed;
    } catch (e) {
      console.debug('Greedy match JSON parsing failed:', e);
      // Fall through to throw
    }
  }

  console.debug('No valid JSON structure found in response');
  throw new Error('Could not extract JSON from response');
}

function parseNutritionFromText(content: string): NutritionResult | null {
  console.debug('Attempting fallback text parsing for nutrition values');

  const refusalIndicators = ['cannot', 'unable', 'sorry', 'no nutritional', 'no information', 'not enough', 'insufficient'];
  const lowerContent = content.toLowerCase();
  for (const indicator of refusalIndicators) {
    if (lowerContent.includes(indicator)) {
      console.debug(`Response contains refusal indicator: "${indicator}"`);
      return null;
    }
  }

  // Patterns to match both plain text and JSON-like syntax
  const patterns: Record<string, RegExp> = {
    calories: /(?:calories|cal|kcal)[\s"':]*(\d+(?:\.\d+)?)/i,
    protein: /(?:protein|protein\s*\(?g\)?)[\s"':]*(\d+(?:\.\d+)?)/i,
    carbohydrates: /(?:carbohydrates?|carbs?|carbohydrates?\s*\(?g\)?)[\s"':]*(\d+(?:\.\d+)?)/i,
    fat: /(?:fat|total\s*fat)[\s"':]*(\d+(?:\.\d+)?)/i,
    saturatedFat: /(?:saturated\s*fat|sat\s*fat)[\s"':]*(\d+(?:\.\d+)?)/i,
    fiber: /(?:fiber|fibre|dietary\s*fiber)[\s"':]*(\d+(?:\.\d+)?)/i,
    sugar: /(?:sugar|sugars)[\s"':]*(\d+(?:\.\d+)?)/i,
    sodium: /(?:sodium)[\s"':]*(\d+(?:\.\d+)?)/i,
    cholesterol: /(?:cholesterol)[\s"':]*(\d+(?:\.\d+)?)/i,
  };

  const result: Partial<NutritionResult> = {};

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = content.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (!isNaN(value)) {
        (result as Record<string, unknown>)[key] = value;
        console.debug(`Extracted ${key}: ${value}`);
      }
    }
  }

  // If we're missing only one or two fields, that's acceptable
  const requiredFields = ['calories', 'protein', 'carbohydrates', 'fat'] as const;
  const missingRequired = requiredFields.filter(key => !(key in result));

  if (missingRequired.length <= 1 && missingRequired.every(key => result[key as keyof NutritionResult] !== undefined)) {
    console.info('Fallback text parsing succeeded with partial data (missing:', missingRequired.join(', '), '):', result);
    return result as NutritionResult;
  }

  console.warn('Fallback text parsing failed to extract required fields. Missing:', missingRequired.join(', '));
  return null;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) throw error(401, 'Not authenticated');

    const body = await request.json();
    const result = nutritionSchema.safeParse(body);
    if (!result.success) throw error(400, result.error.message);

    const { ingredients, servings, title } = result.data;
    const aiService = await AIServiceV2.getInstance();

    const userPrompt = `Calculate the nutritional information per serving for this recipe${title ? ` "${title}"` : ''}.

Ingredients:
${ingredients.join('\n')}

Total servings: ${servings}

Return a complete JSON object with these fields (all numbers, no units):
{
  "calories": number,
  "protein": number,
  "carbohydrates": number,
  "fat": number,
  "saturatedFat": number (if known, otherwise omit),
  "fiber": number (if known, otherwise omit),
  "sugar": number (if known, otherwise omit),
  "sodium": number (if known, otherwise omit),
  "cholesterol": number (if known, otherwise omit)
}

Example complete response:
{
  "calories": 350,
  "protein": 20,
  "carbohydrates": 45,
  "fat": 12,
  "fiber": 3
}

CRITICAL:
- Ensure the JSON is complete with all required fields you provide
- The JSON must end with a closing brace }
- Do not truncate or stop mid-response
- Return ONLY the JSON object, no other text`;

    const generationResult = await aiService.generateForFeature(AIFeature.NUTRITION_CALCULATION, {
      messages: [{ role: 'user', content: userPrompt }],
      // Note: Not using jsonMode to avoid truncation issues - prompt engineering is sufficient
    });

    const content = generationResult.content;
    let nutritionData: NutritionResult | undefined;

    try {
      const rawData = extractJSONFromResponse(content) as Record<string, unknown>;
      console.debug('Extracted object:', JSON.stringify(rawData).substring(0, 500));

      const validatedData = parsedNutritionSchema.parse(rawData);
      const data: NutritionResult = {
        calories: validatedData.calories,
        protein: validatedData.protein,
        carbohydrates: validatedData.carbohydrates,
        fat: validatedData.fat,
      };
      if (validatedData.saturatedFat !== undefined) data.saturatedFat = validatedData.saturatedFat;
      if (validatedData.fiber !== undefined) data.fiber = validatedData.fiber;
      if (validatedData.sugar !== undefined) data.sugar = validatedData.sugar;
      if (validatedData.sodium !== undefined) data.sodium = validatedData.sodium;
      if (validatedData.cholesterol !== undefined) data.cholesterol = validatedData.cholesterol;

      if (!isNutritionDataReasonable(data)) {
        console.warn('Nutrition data failed sanity check, will try fallback parsing');
        nutritionData = undefined;
      } else {
        console.info('Nutrition parsing succeeded with data:', data);
        nutritionData = data;
      }
    } catch (e) {
      console.warn('JSON parsing failed:', e instanceof Error ? e.message : String(e));
      nutritionData = undefined;
    }

    if (!nutritionData) {
      const fallbackData = parseNutritionFromText(content);
      if (fallbackData) {
        nutritionData = fallbackData;
        console.info('Fallback text parsing succeeded with data:', nutritionData);
      }
    }

    if (!nutritionData) {
      console.error('Failed to extract nutrition data from AI response.', {
        contentLength: content.length,
        contentPreview: content.substring(0, Math.min(1000, content.length))
      });
      throw error(500, 'Failed to parse nutrition data from AI response');
    }

    return json(nutritionData);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Calculate nutrition error:', e);
    throw error(500, 'Failed to calculate nutrition');
  }
};
