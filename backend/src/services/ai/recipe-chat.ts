import { db } from '../../db/index.js';
import { settings, memories, agents } from '../../db/schema.js';
import { decrypt } from '../../utils/encryption.js';
import { eq, and } from 'drizzle-orm';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 data URIs from frontend
}

// Content block types for Anthropic API
type ImageContentBlock = {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
};

type TextContentBlock = {
  type: 'text';
  text: string;
};

type ContentBlock = ImageContentBlock | TextContentBlock;

/**
 * Transform a message's content for the Anthropic API.
 * If the message has images, returns a content block array.
 * Otherwise, returns the plain string content.
 */
function buildMessageContent(message: ChatMessage): string | ContentBlock[] {
  if (!message.images?.length) {
    return message.content;
  }

  const content: ContentBlock[] = [];

  // Add images first
  for (const image of message.images) {
    // Parse data URI: "data:image/jpeg;base64,..."
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: match[1],
          data: match[2],
        },
      });
    }
  }

  // Add text content
  if (message.content) {
    content.push({
      type: 'text',
      text: message.content,
    });
  }

  return content;
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
- Tags should be relevant categories like "dinner", "vegetarian", "quick", "italian", etc.
- ALWAYS use metric units for ingredients (grams, kilograms, milliliters, liters)
- ALWAYS use Celsius for temperatures
- Example ingredients: "250g flour", "500ml milk", "100g butter"`;

async function getApiConfig(): Promise<{ apiKey: string; model: string; secondaryModel: string } | null> {
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
      secondaryModel: appSettings.anthropicSecondaryModel || 'claude-3-haiku-20240307',
    };
  } catch {
    return null;
  }
}

/**
 * Get enabled memories for a user
 */
async function getEnabledMemories(userId: string): Promise<string[]> {
  const userMemories = await db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.enabled, true)));
  return userMemories.map((m) => m.content);
}

/**
 * Get agent by ID
 */
async function getAgent(agentId: string): Promise<{ systemPrompt: string; modelId: string | null } | null> {
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  return agent ? { systemPrompt: agent.systemPrompt, modelId: agent.modelId } : null;
}

/**
 * Build system prompt with user memories appended
 */
function buildSystemPromptWithMemories(basePrompt: string, userMemories: string[]): string {
  if (userMemories.length === 0) return basePrompt;

  return `${basePrompt}

User Preferences & Memories:
${userMemories.map((m) => `- ${m}`).join('\n')}

Always consider these preferences when making suggestions.`;
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
Be friendly and helpful, like a knowledgeable friend in the kitchen.
ALWAYS use metric units (grams, ml, liters) for any quantities and Celsius for temperatures.`;

export interface RecipeContext {
  title: string;
  description?: string | null;
  ingredients: string[];
  instructions: string[];
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  tags?: string[] | null;
}

export interface SpecificRecipeChatInput {
  recipe: RecipeContext;
  messages: ChatMessage[];
}

/**
 * Chat about a specific recipe - answer questions, suggest modifications, etc.
 */
export async function chatAboutSpecificRecipe(
  input: SpecificRecipeChatInput,
  userId?: string
): Promise<{ message: string }> {
  const config = await getApiConfig();

  if (!config) {
    throw new Error('AI service not configured. Please add your Anthropic API key in Settings.');
  }

  // Get user memories if userId is provided
  const userMemories = userId ? await getEnabledMemories(userId) : [];
  const systemPrompt = buildSystemPromptWithMemories(SPECIFIC_RECIPE_CHAT_SYSTEM_PROMPT, userMemories);

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
  const messagesWithContext: ChatMessage[] = [
    { role: 'user' as const, content: recipeContext },
    { role: 'assistant' as const, content: 'I can see this recipe. What would you like to know about it?' },
    ...input.messages,
  ];

  // Use secondary model for recipe Q&A (simpler task than creative brainstorming)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.secondaryModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messagesWithContext.map((m) => ({
        role: m.role,
        content: buildMessageContent(m),
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
  input: RecipeChatInput,
  userId?: string,
  agentId?: string
): Promise<RecipeChatResponse> {
  const config = await getApiConfig();

  if (!config) {
    throw new Error('AI service not configured. Please add your Anthropic API key in Settings.');
  }

  // Get agent if specified
  const agent = agentId ? await getAgent(agentId) : null;

  // Get user memories if userId is provided
  const userMemories = userId ? await getEnabledMemories(userId) : [];

  // Use agent's system prompt or default
  const basePrompt = agent?.systemPrompt || RECIPE_CHAT_SYSTEM_PROMPT;
  const systemPrompt = buildSystemPromptWithMemories(basePrompt, userMemories);

  // Use agent's specific model or default to primary model from settings
  const modelToUse = agent?.modelId || config.model;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelToUse,
      max_tokens: 2048,
      system: systemPrompt,
      messages: input.messages.map((m) => ({
        role: m.role,
        content: buildMessageContent(m),
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
