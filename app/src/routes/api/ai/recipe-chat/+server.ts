import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import type { Message } from '$lib/server/ai/providers';

const recipeChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  agentId: z.string().optional(),
  referencedRecipes: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    ingredients: z.array(z.string()),
    instructions: z.array(z.string()),
  })).optional(),
});

interface GeneratedRecipe {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags: string[];
}

// POST /api/ai/recipe-chat - AI chat for recipe assistance
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = recipeChatSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { messages, referencedRecipes } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    // Build system prompt
    let systemPrompt = `You are a helpful cooking assistant. You help users with recipe questions, cooking techniques, ingredient substitutions, and meal planning.
Be concise and practical in your responses.

When the user asks for a recipe or describes what they want to make, you should provide a complete recipe in the following JSON format at the end of your response:

<recipe>
{
  "title": "Recipe Name",
  "description": "Brief description of the recipe",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "instructions": ["step 1", "step 2", ...],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "tags": ["tag1", "tag2"]
}
</recipe>

The prepTime and cookTime are in minutes. Only include the JSON block when providing a complete recipe.`;

    if (referencedRecipes && referencedRecipes.length > 0) {
      systemPrompt += '\n\nThe user is asking about these recipes:\n';
      for (const recipe of referencedRecipes) {
        systemPrompt += `\n- ${recipe.title}: ${recipe.description || 'No description'}\n`;
        systemPrompt += `  Ingredients: ${recipe.ingredients.join(', ')}\n`;
      }
    }

    // Map messages to proper format
    const mappedMessages: Message[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_CHAT, {
      systemPrompt,
      messages: mappedMessages,
    });

    // Parse recipe from response if present
    let parsedRecipe: GeneratedRecipe | undefined;
    const recipeMatch = generationResult.content.match(/<recipe>([\s\S]*?)<\/recipe>/);

    if (recipeMatch) {
      try {
        const recipeJson = recipeMatch[1].trim();
        parsedRecipe = JSON.parse(recipeJson);
      } catch (parseErr) {
        console.error('Failed to parse recipe JSON:', parseErr);
      }
    }

    // Clean up the message by removing the recipe JSON block
    let cleanMessage = generationResult.content
      .replace(/<recipe>[\s\S]*?<\/recipe>/g, '')
      .trim();

    return json({
      message: cleanMessage,
      recipe: parsedRecipe
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Recipe chat error:', e);
    throw error(500, 'Failed to process chat message');
  }
};