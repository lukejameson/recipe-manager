import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { AIConfigurationError, isAIConfigurationError } from '$lib/utils/errors';

const searchRecipesSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

// POST /api/ai/search-recipes-mention - Find recipes that might be mentioned in text
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = searchRecipesSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { query, limit } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    // Use AI to extract recipe names from the query
    const userPrompt = `Extract recipe names or dish names mentioned in this query: "${query}"

Return ONLY a JSON array of recipe names. If no recipes are mentioned, return an empty array.`;

    const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_MENTION_SEARCH, {
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = generationResult.content;

    let recipeNames: string[];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recipeNames = JSON.parse(jsonMatch[0]) as string[];
      } else {
        recipeNames = [];
      }
    } catch {
      recipeNames = [];
    }

    // Return mock recipe matches (in a real implementation, this would search the database)
    // For now, return the extracted names as potential matches
    const matches = recipeNames.map((name, index) => ({
      id: `search-result-${index}`,
      title: name,
      description: `Potential match for "${name}"`,
      ingredients: [],
      instructions: [],
    }));

    return json(matches.slice(0, limit));
  } catch (e) {
    if ('status' in e) throw e;
    if (isAIConfigurationError(e)) {
      throw error(503, e.message);
    }
    console.error('Search recipes mention error:', e);
    return json([]);
  }
};