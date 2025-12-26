import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { settings } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../../utils/encryption.js';

const t = initTRPC.context<Context>().create();

// Auth middleware
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }
  return next({ ctx: { userId: ctx.userId } });
});

const protectedProcedure = t.procedure.use(isAuthenticated);

// Fallback models if API fetch fails
const FALLBACK_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
];

// Fetch available models from Anthropic API
async function fetchAvailableModels(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch models:', response.statusText);
      return FALLBACK_MODELS;
    }

    const data = (await response.json()) as {
      data: Array<{
        id: string;
        display_name: string;
        type: string;
      }>;
    };

    // Filter to only chat models and format them
    const models = data.data
      .filter((m) => m.type === 'model')
      .map((m) => ({
        id: m.id,
        name: m.display_name || m.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return models.length > 0 ? models : FALLBACK_MODELS;
  } catch (error) {
    console.error('Error fetching models:', error);
    return FALLBACK_MODELS;
  }
}

export const settingsRouter = t.router({
  /**
   * Get current settings (masks API key for security)
   */
  get: protectedProcedure.query(async () => {
    const [appSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 'app-settings'))
      .limit(1);

    // Fetch models dynamically if we have an API key
    let availableModels = FALLBACK_MODELS;
    if (appSettings?.anthropicApiKey) {
      try {
        const decryptedKey = decrypt(appSettings.anthropicApiKey);
        availableModels = await fetchAvailableModels(decryptedKey);
      } catch (error) {
        console.error('Failed to decrypt API key or fetch models:', error);
      }
    }

    return {
      hasApiKey: !!appSettings?.anthropicApiKey,
      model: appSettings?.anthropicModel || 'claude-sonnet-4-20250514',
      secondaryModel: appSettings?.anthropicSecondaryModel || 'claude-3-haiku-20240307',
      availableModels,
    };
  }),

  /**
   * Fetch available models using a provided API key (for testing before saving)
   */
  fetchModels: protectedProcedure
    .input(z.object({ apiKey: z.string() }))
    .query(async ({ input }) => {
      const models = await fetchAvailableModels(input.apiKey);
      return { models };
    }),

  /**
   * Update settings (API key and/or models)
   */
  update: protectedProcedure
    .input(
      z.object({
        anthropicApiKey: z.string().optional(),
        anthropicModel: z.string().optional(),
        anthropicSecondaryModel: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };

      // Handle API key - empty string means clear, undefined means don't change
      if (input.anthropicApiKey !== undefined) {
        updateData.anthropicApiKey = input.anthropicApiKey
          ? encrypt(input.anthropicApiKey)
          : null;
      }

      if (input.anthropicModel) {
        updateData.anthropicModel = input.anthropicModel;
      }

      if (input.anthropicSecondaryModel) {
        updateData.anthropicSecondaryModel = input.anthropicSecondaryModel;
      }

      // Check if settings row exists
      const [existing] = await db
        .select()
        .from(settings)
        .where(eq(settings.id, 'app-settings'))
        .limit(1);

      if (existing) {
        await db
          .update(settings)
          .set(updateData)
          .where(eq(settings.id, 'app-settings'));
      } else {
        await db.insert(settings).values({
          id: 'app-settings',
          ...updateData,
        });
      }

      return { success: true };
    }),

  /**
   * Test an API key by making a minimal request to Anthropic
   */
  testApiKey: protectedProcedure
    .input(z.object({ apiKey: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': input.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
          return {
            valid: false,
            error: errorData.error?.message || 'Invalid API key',
          };
        }

        return { valid: true };
      } catch (error: any) {
        return {
          valid: false,
          error: error.message || 'Failed to connect to Anthropic API',
        };
      }
    }),
});
