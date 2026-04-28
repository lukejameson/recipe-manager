import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import type { Message } from '$lib/server/ai/providers';
import { AIConfigurationError, isAIConfigurationError, AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';

/**
 * POST /api/ai/chat - Chat about a specific recipe
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const { recipe, messages } = body;

    if (!recipe || !messages || !Array.isArray(messages)) {
      throw error(400, 'Recipe and messages array are required');
    }

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    // Build system prompt for recipe chat
    const systemPrompt = `You are a helpful cooking assistant chatting about a specific recipe.
Be conversational, helpful, and provide specific advice about the recipe.
Recipe: ${recipe.title}
Description: ${recipe.description || 'N/A'}
Ingredients: ${recipe.ingredients?.join(', ') || 'N/A'}
Instructions: ${recipe.instructions?.join('; ') || 'N/A'}
Servings: ${recipe.servings || 'N/A'}
Prep time: ${recipe.prepTime ? recipe.prepTime + ' min' : 'N/A'}
Cook time: ${recipe.cookTime ? recipe.cookTime + ' min' : 'N/A'}`;

    // Map messages to proper format
    const mappedMessages: Message[] = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Use AIServiceV2 for generation
    const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_CHAT_CONTEXTUAL, {
      systemPrompt,
      messages: mappedMessages,
    });

    return json({
      message: generationResult.content || 'Sorry, I could not generate a response.',
    });
  } catch (e) {
    if ('status' in e) throw e;
    if (isAIRateLimitError(e)) {
      throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
    }
    if (isAIConfigurationError(e)) {
      throw error(503, e.message);
    }
    console.error('Chat about recipe error:', e);
    throw error(500, 'Internal server error');
  }
};
