import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { settings, memories, users } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
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

// Admin middleware
const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, ctx.userId),
  });

  if (!user || !user.isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({ ctx: { userId: ctx.userId, isAdmin: true } });
});

const protectedProcedure = t.procedure.use(isAuthenticated);
const adminProcedure = t.procedure.use(isAdmin);

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
   * Admin-only for API key info, but returns whether features are available for all users
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const [appSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 'app-settings'))
      .limit(1);

    // Check if current user is admin
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
    });
    const isAdminUser = user?.isAdmin ?? false;

    // Only fetch models for admins
    let availableModels = FALLBACK_MODELS;
    if (isAdminUser && appSettings?.anthropicApiKey) {
      try {
        const decryptedKey = decrypt(appSettings.anthropicApiKey);
        availableModels = await fetchAvailableModels(decryptedKey);
      } catch (error) {
        console.error('Failed to decrypt API key or fetch models:', error);
      }
    }

    return {
      hasApiKey: !!appSettings?.anthropicApiKey,
      hasPexelsApiKey: !!appSettings?.pexelsApiKey,
      model: appSettings?.anthropicModel || 'claude-sonnet-4-20250514',
      secondaryModel: appSettings?.anthropicSecondaryModel || 'claude-3-haiku-20240307',
      availableModels: isAdminUser ? availableModels : [],
      isAdmin: isAdminUser,
    };
  }),

  /**
   * Fetch available models using a provided API key (for testing before saving)
   * Admin-only
   */
  fetchModels: adminProcedure
    .input(z.object({ apiKey: z.string() }))
    .query(async ({ input }) => {
      const models = await fetchAvailableModels(input.apiKey);
      return { models };
    }),

  /**
   * Update settings (API key and/or models)
   * Admin-only
   */
  update: adminProcedure
    .input(
      z.object({
        anthropicApiKey: z.string().optional(),
        anthropicModel: z.string().optional(),
        anthropicSecondaryModel: z.string().optional(),
        pexelsApiKey: z.string().optional(),
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

      // Handle Pexels API key - same pattern as Anthropic key
      if (input.pexelsApiKey !== undefined) {
        updateData.pexelsApiKey = input.pexelsApiKey
          ? encrypt(input.pexelsApiKey)
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
   * Admin-only
   */
  testApiKey: adminProcedure
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

  /**
   * List all memories for the current user
   */
  listMemories: protectedProcedure.query(async ({ ctx }) => {
    const userMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, ctx.userId))
      .orderBy(desc(memories.createdAt));
    return userMemories;
  }),

  /**
   * Create a new memory
   */
  createMemory: protectedProcedure
    .input(z.object({ content: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const [memory] = await db
        .insert(memories)
        .values({
          userId: ctx.userId,
          content: input.content,
          enabled: true,
        })
        .returning();
      return memory;
    }),

  /**
   * Update a memory (toggle enabled or edit content)
   */
  updateMemory: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        enabled: z.boolean().optional(),
        content: z.string().min(1).max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await db
        .select()
        .from(memories)
        .where(and(eq(memories.id, input.id), eq(memories.userId, ctx.userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Memory not found',
        });
      }

      const updateData: Record<string, any> = {};
      if (input.enabled !== undefined) {
        updateData.enabled = input.enabled;
      }
      if (input.content !== undefined) {
        updateData.content = input.content;
      }

      if (Object.keys(updateData).length === 0) {
        return existing;
      }

      const [updated] = await db
        .update(memories)
        .set(updateData)
        .where(eq(memories.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a memory
   */
  deleteMemory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await db
        .select()
        .from(memories)
        .where(and(eq(memories.id, input.id), eq(memories.userId, ctx.userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Memory not found',
        });
      }

      await db.delete(memories).where(eq(memories.id, input.id));
      return { success: true };
    }),
});
