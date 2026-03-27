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

// POST /api/ai/calculate-nutrition - Calculate nutrition information using AI
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = nutritionSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { ingredients, servings, title } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    const userPrompt = `Calculate the nutritional information per serving for this recipe${title ? ` "${title}"` : ''}.

Ingredients:
${ingredients.join('\n')}

Total servings: ${servings}

Return ONLY a JSON object with these fields (values per serving):
{
  "calories": number (kcal),
  "protein": number (grams),
  "carbohydrates": number (grams),
  "fat": number (grams),
  "saturatedFat": number (grams, optional),
  "fiber": number (grams, optional),
  "sugar": number (grams, optional),
  "sodium": number (milligrams, optional),
  "cholesterol": number (milligrams, optional)
}`;

    const generationResult = await aiService.generateForFeature(AIFeature.NUTRITION_CALCULATION, {
      messages: [{ role: 'user', content: userPrompt }],
      jsonMode: true,
    });

    const content = generationResult.content;

    // Extract JSON from response
    let nutritionData: Record<string, unknown>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        nutritionData = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      console.error('Failed to parse AI response:', content);
      throw error(500, 'Failed to parse nutrition data');
    }

    return json(nutritionData);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Calculate nutrition error:', e);
    throw error(500, 'Failed to calculate nutrition');
  }
};