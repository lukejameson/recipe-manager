import { db } from '../../db/index.js';
import { settings } from '../../db/schema.js';
import { decrypt } from '../../utils/encryption.js';
import { eq } from 'drizzle-orm';

export interface AICompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  /** Override the default model (use 'haiku' for simple tasks) */
  useHaiku?: boolean;
}

export interface AICompletionResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Generic AI service that can be extended for various AI-powered features.
 * Currently supports Anthropic's Claude API.
 */
export class AIService {
  private apiKey: string | null = null;
  private model: string = 'claude-3-5-sonnet-20241022';
  private secondaryModel: string = 'claude-3-haiku-20240307';

  /**
   * Load API key and models from database settings.
   * Must be called before using the service.
   * @returns true if the service is properly configured
   */
  async initialize(): Promise<boolean> {
    try {
      const [appSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.id, 'app-settings'))
        .limit(1);

      if (!appSettings?.anthropicApiKey) {
        this.apiKey = null;
        return false;
      }

      this.apiKey = decrypt(appSettings.anthropicApiKey);
      this.model = appSettings.anthropicModel || 'claude-3-5-sonnet-20241022';
      this.secondaryModel = appSettings.anthropicSecondaryModel || 'claude-3-haiku-20240307';
      return true;
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      this.apiKey = null;
      return false;
    }
  }

  /**
   * Check if the AI service is configured with an API key
   */
  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Get the currently configured model
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Generic completion method that can be used by specialized AI features.
   * @param options - The completion options including system and user prompts
   * @returns The completion result with content and usage statistics
   */
  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    if (!this.apiKey) {
      throw new Error('AI service not initialized. Please configure your API key in Settings.');
    }

    // Use secondary model (typically Haiku) for simple tasks to reduce costs
    const modelToUse = options.useHaiku ? this.secondaryModel : this.model;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelToUse,
        max_tokens: options.maxTokens || 1024,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: options.userPrompt }],
        temperature: options.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`Anthropic API error: ${errorMessage}`);
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0].text,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    };
  }

  /**
   * Execute multiple AI completions in parallel with concurrency limit.
   * Useful for batch operations like calculating nutrition for multiple recipes.
   * @param optionsArray - Array of completion options
   * @param concurrencyLimit - Maximum parallel requests (default: 3)
   * @returns Array of results (in same order as input)
   */
  async batchComplete(
    optionsArray: AICompletionOptions[],
    concurrencyLimit: number = 3
  ): Promise<Array<AICompletionResult | { error: string }>> {
    const results: Array<AICompletionResult | { error: string }> = new Array(optionsArray.length);

    const processItem = async (index: number): Promise<void> => {
      try {
        results[index] = await this.complete(optionsArray[index]);
      } catch (error) {
        results[index] = {
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    };

    // Process in batches with concurrency limit
    const indices = optionsArray.map((_, i) => i);
    for (let i = 0; i < indices.length; i += concurrencyLimit) {
      const batch = indices.slice(i, i + concurrencyLimit);
      await Promise.all(batch.map(processItem));
    }

    return results;
  }
}

// Singleton instance for use across the application
export const aiService = new AIService();
