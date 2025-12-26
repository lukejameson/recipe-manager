import { db } from '../../db/index.js';
import { settings } from '../../db/schema.js';
import { decrypt } from '../../utils/encryption.js';
import { eq } from 'drizzle-orm';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RecipeChatInput {
  messages: ChatMessage[];
}

export interface GeneratedRecipe {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags: string[];
}

export interface RecipeChatResponse {
  message: string;
  recipe?: GeneratedRecipe;
}

const RECIPE_CHAT_SYSTEM_PROMPT = `You are a friendly, creative culinary assistant helping users brainstorm and create new recipes. Your role is to:

1. Help users come up with recipe ideas based on their preferences, ingredients, cuisines, or dietary needs
2. Suggest creative variations and combinations
3. Provide complete recipes when asked
4. Answer cooking questions and give tips

When the user asks you to create or finalize a recipe, include a JSON block with the full recipe details. Format it exactly like this:

\`\`\`recipe
{
  "title": "Recipe Name",
  "description": "A brief appetizing description",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": ["Step 1", "Step 2"],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "tags": ["tag1", "tag2"]
}
\`\`\`

Guidelines:
- Be conversational and enthusiastic about food
- Ask clarifying questions to understand preferences
- Suggest ideas proactively
- When giving a full recipe, always include the recipe JSON block
- Keep responses concise but helpful
- Times are in minutes
- Tags should be relevant categories like "dinner", "vegetarian", "quick", "italian", etc.`;

async function getApiConfig(): Promise<{ apiKey: string; model: string } | null> {
  try {
    const [appSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 'app-settings'))
      .limit(1);

    if (!appSettings?.anthropicApiKey) {
      return null;
    }

    return {
      apiKey: decrypt(appSettings.anthropicApiKey),
      model: appSettings.anthropicModel || 'claude-3-5-sonnet-20241022',
    };
  } catch {
    return null;
  }
}

// System prompt for chatting about a specific recipe
const SPECIFIC_RECIPE_CHAT_SYSTEM_PROMPT = `You are a helpful culinary assistant. The user is viewing a specific recipe and wants to ask questions about it.

You can help with:
- Explaining techniques or ingredients
- Suggesting modifications or substitutions
- Scaling the recipe up or down
- Dietary adaptations
- Troubleshooting cooking issues
- Pairing suggestions (wines, sides, etc.)
- Storage and reheating tips
- Timing and prep advice

Keep your responses concise and practical. Focus on the specific recipe context provided.
If the user asks for a modified version of the recipe, you can provide updated ingredients or instructions.
Be friendly and helpful, like a knowledgeable friend in the kitchen.`;

export interface RecipeContext {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags?: string[];
}

export interface SpecificRecipeChatInput {
  recipe: RecipeContext;
  messages: ChatMessage[];
}

/**
 * Chat about a specific recipe - answer questions, suggest modifications, etc.
 */
export async function chatAboutSpecificRecipe(
  input: SpecificRecipeChatInput
): Promise<{ message: string }> {
  const config = await getApiConfig();

  if (!config) {
    throw new Error('AI service not configured. Please add your Anthropic API key in Settings.');
  }

  // Build the recipe context as the first message
  const recipeContext = `Here is the recipe the user is asking about:

**${input.recipe.title}**
${input.recipe.description ? `\n${input.recipe.description}\n` : ''}
${input.recipe.servings ? `Servings: ${input.recipe.servings}` : ''}
${input.recipe.prepTime ? ` | Prep: ${input.recipe.prepTime} min` : ''}
${input.recipe.cookTime ? ` | Cook: ${input.recipe.cookTime} min` : ''}
${input.recipe.tags?.length ? `\nTags: ${input.recipe.tags.join(', ')}` : ''}

**Ingredients:**
${input.recipe.ingredients.map((i) => `- ${i}`).join('\n')}

**Instructions:**
${input.recipe.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}`;

  // Prepend recipe context to messages
  const messagesWithContext = [
    { role: 'user' as const, content: recipeContext },
    { role: 'assistant' as const, content: 'I can see this recipe. What would you like to know about it?' },
    ...input.messages,
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      system: SPECIFIC_RECIPE_CHAT_SYSTEM_PROMPT,
      messages: messagesWithContext.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`AI error: ${errorMessage}`);
  }

  const data = (await response.json()) as {
    content: Array<{ text: string }>;
  };

  return {
    message: data.content[0].text,
  };
}

export async function chatAboutRecipes(
  input: RecipeChatInput
): Promise<RecipeChatResponse> {
  const config = await getApiConfig();

  if (!config) {
    throw new Error('AI service not configured. Please add your Anthropic API key in Settings.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: RECIPE_CHAT_SYSTEM_PROMPT,
      messages: input.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`AI error: ${errorMessage}`);
  }

  const data = (await response.json()) as {
    content: Array<{ text: string }>;
  };

  const messageContent = data.content[0].text;

  // Extract recipe JSON if present
  const recipeMatch = messageContent.match(/```recipe\n([\s\S]*?)\n```/);
  let recipe: GeneratedRecipe | undefined;

  if (recipeMatch) {
    try {
      const parsed = JSON.parse(recipeMatch[1]);
      recipe = {
        title: String(parsed.title || 'Untitled Recipe').slice(0, 200),
        description: String(parsed.description || '').slice(0, 1000),
        ingredients: Array.isArray(parsed.ingredients)
          ? parsed.ingredients.map((i: any) => String(i).slice(0, 500))
          : [],
        instructions: Array.isArray(parsed.instructions)
          ? parsed.instructions.map((i: any) => String(i).slice(0, 1000))
          : [],
        prepTime: typeof parsed.prepTime === 'number' ? parsed.prepTime : undefined,
        cookTime: typeof parsed.cookTime === 'number' ? parsed.cookTime : undefined,
        servings: typeof parsed.servings === 'number' ? parsed.servings : undefined,
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.map((t: any) => String(t).slice(0, 50))
          : [],
      };
    } catch {
      // Failed to parse recipe, continue without it
    }
  }

  // Clean up the message by removing the recipe JSON block for display
  const cleanMessage = messageContent.replace(/```recipe\n[\s\S]*?\n```/g, '').trim();

  return {
    message: cleanMessage,
    recipe,
  };
}
