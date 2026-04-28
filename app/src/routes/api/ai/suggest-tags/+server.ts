import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { PromptService } from '$lib/server/ai/prompt-service';
import { AIConfigurationError, isAIConfigurationError, AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';

const suggestTagsSchema = z.object({
  recipe: z.object({
    title: z.string(),
    description: z.string().optional(),
    ingredients: z.array(z.string()),
  }),
  existingTags: z.array(z.string()),
});

// POST /api/ai/suggest-tags - Suggest tags for a recipe
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = suggestTagsSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { recipe, existingTags } = result.data;
    const aiService = await AIServiceV2.getInstance();
    const promptData = await PromptService.getPrompt(AIFeature.TAG_SUGGESTIONS);
    let systemPrompt = promptData?.content || `Suggest 3-7 relevant tags for this recipe. Exclude these existing tags: {{existing_tags}}.
Recipe: {{recipe_title}}
Description: {{recipe_description}}
Ingredients: {{ingredients}}
Return ONLY a JSON array of tag strings.`;
    systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
      existing_tags: existingTags.join(', ') || 'none',
      recipe_title: recipe.title,
      recipe_description: recipe.description || 'N/A',
      ingredients: recipe.ingredients.join(', ')
    });
    const genResult = await aiService.generateForFeature(AIFeature.TAG_SUGGESTIONS, {
      systemPrompt,
      messages: [{ role: 'user', content: 'Please suggest tags for this recipe.' }],
    });
    const content = genResult.content;

    let suggestedTags: string[];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestedTags = JSON.parse(jsonMatch[0]) as string[];
      } else {
        suggestedTags = content.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    } catch {
      suggestedTags = [];
    }

    return json({ suggestedTags });
  } catch (e) {
    if ('status' in e) throw e;
    if (isAIRateLimitError(e)) {
      throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
    }
    if (isAIConfigurationError(e)) {
      throw error(503, e.message);
    }
    console.error('Suggest tags error:', e);
    throw error(500, 'Failed to suggest tags');
  }
};