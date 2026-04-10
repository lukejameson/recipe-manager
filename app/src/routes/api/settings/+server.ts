import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { settings, memories, users } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { decrypt, encrypt } from '$lib/server/utils/encryption';

// GET /api/settings - Get current settings
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const [appSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 'app-settings'))
      .limit(1);

    // Check if current user is admin
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    const isAdminUser = userRecord?.isAdmin ?? false;

    // Fetch available models from Anthropic API if key exists
    let availableModels: Array<{ id: string; name: string }> = [];

    if (appSettings?.anthropicApiKey && isAdminUser) {
      try {
        // Decrypt key if needed (reuse logic from aiService)
        let apiKey = appSettings.anthropicApiKey;
        try {
          apiKey = decrypt(appSettings.anthropicApiKey);
        } catch {
          // If decryption fails, use as-is (plaintext)
          if (!apiKey.startsWith('sk-')) {
            apiKey = '';
          }
        }

        if (apiKey) {
          const response = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
          });

          if (response.ok) {
            const data = await response.json();
            availableModels = data.data?.map((m: any) => ({
              id: m.id,
              name: m.display_name || m.id,
            })) || [];
          }
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
        availableModels = [];
      }
    }

    return json({
      hasApiKey: !!appSettings?.anthropicApiKey,
      hasPexelsApiKey: !!appSettings?.pexelsApiKey,
      hasInstagramAppId: !!appSettings?.instagramAppId,
      hasInstagramAppSecret: !!appSettings?.instagramAppSecret,
      model: appSettings?.anthropicModel || 'claude-sonnet-4-20250514',
      secondaryModel: appSettings?.anthropicSecondaryModel || 'claude-3-haiku-20240307',
      availableModels,
      isAdmin: isAdminUser,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get settings error:', e);
    throw error(500, 'Internal server error');
  }
};

// PUT /api/settings - Update settings (admin only)
export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    // Check if admin
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!userRecord?.isAdmin) {
      throw error(403, 'Admin access required');
    }

    const body = await request.json();
    const schema = z.object({
      anthropicApiKey: z.string().optional(),
      anthropicModel: z.string().optional(),
      anthropicSecondaryModel: z.string().optional(),
      pexelsApiKey: z.string().optional(),
      instagramAppId: z.string().optional(),
      instagramAppSecret: z.string().optional(),
    });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    // Check if settings row exists
    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 'app-settings'))
      .limit(1);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (result.data.anthropicApiKey !== undefined) {
      updateData.anthropicApiKey = result.data.anthropicApiKey || null;
    }

    if (result.data.pexelsApiKey !== undefined) {
      updateData.pexelsApiKey = result.data.pexelsApiKey || null;
    }
    if (result.data.instagramAppId !== undefined) {
      updateData.instagramAppId = result.data.instagramAppId
        ? encrypt(result.data.instagramAppId)
        : null;
    }
    if (result.data.instagramAppSecret !== undefined) {
      updateData.instagramAppSecret = result.data.instagramAppSecret
        ? encrypt(result.data.instagramAppSecret)
        : null;
    }

    if (result.data.anthropicModel) {
      updateData.anthropicModel = result.data.anthropicModel;
    }

    if (result.data.anthropicSecondaryModel) {
      updateData.anthropicSecondaryModel = result.data.anthropicSecondaryModel;
    }

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

    return json({ success: true });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Update settings error:', e);
    throw error(500, 'Internal server error');
  }
};
