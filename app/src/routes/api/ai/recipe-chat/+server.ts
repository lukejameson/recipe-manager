import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { PromptService } from '$lib/server/ai/prompt-service';
import type { Message } from '$lib/server/ai/providers';
import { AIConfigurationError, isAIConfigurationError, AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';
import { db } from '$lib/server/db/db';
import { agents } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

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
    const { messages, agentId, referencedRecipes } = result.data;

    const aiService = await AIServiceV2.getInstance();

    let systemPrompt: string;

    if (agentId) {
      const agentResult = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
      if (agentResult.length > 0) {
        systemPrompt = agentResult[0].systemPrompt;
      } else {
        systemPrompt = `You are a helpful cooking assistant.`;
      }
    } else {
      const promptData = await PromptService.getPrompt(AIFeature.RECIPE_CHAT);
      systemPrompt = promptData?.content || `You are a helpful cooking assistant.`;
    }

    if (referencedRecipes && referencedRecipes.length > 0) {
      systemPrompt += '\n\nThe user is asking about these recipes:\n';
      for (const recipe of referencedRecipes) {
        systemPrompt += `\n- ${recipe.title}: ${recipe.description || 'No description'}\n`;
        systemPrompt += `  Ingredients: ${recipe.ingredients.join(', ')}\n`;
      }
    }

    const mappedMessages: Message[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_CHAT, {
      systemPrompt,
      messages: mappedMessages,
    });

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

    let cleanMessage = generationResult.content
      .replace(/<recipe>[\s\S]*?<\/recipe>/g, '')
      .trim();

    return json({
      message: cleanMessage,
      recipe: parsedRecipe
    });
  } catch (e) {
    if ('status' in e) throw e;
    if (isAIRateLimitError(e)) {
      throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
    }
    if (isAIConfigurationError(e)) {
      throw error(503, e.message);
    }
    console.error('Recipe chat error:', e);
    throw error(500, 'Failed to process chat message');
  }
};
