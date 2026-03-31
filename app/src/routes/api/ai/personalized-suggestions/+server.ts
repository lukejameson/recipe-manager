import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';

/**
 * GET /api/ai/personalized-suggestions - Get personalized recipe suggestions based on user history
 */
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // For now, return default suggestions
    // TODO: In the future, this could analyze user's recipe history and preferences
    // to generate personalized suggestions using AI
    const defaultSuggestions = [
      "What can I make with chicken and rice?",
      "Suggest a quick weeknight dinner",
      "Give me a healthy salad recipe",
      "What should I make for a dinner party?",
      "Help me meal prep for the week",
      "Create a recipe using seasonal vegetables",
    ];

    return json({
      suggestions: defaultSuggestions,
    });
  } catch (e) {
    if ('status' in e) throw e;
    console.error('Get personalized suggestions error:', e);
    throw error(500, 'Internal server error');
  }
};
