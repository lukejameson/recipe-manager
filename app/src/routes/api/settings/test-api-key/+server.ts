import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';

const testApiKeySchema = z.object({
  apiKey: z.string().min(1),
});

// POST /api/settings/test-api-key - Test if an Anthropic API key is valid
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = testApiKeySchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { apiKey } = result.data;

    // Test the API key by making a simple request to Anthropic
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (response.ok) {
      return json({ valid: true });
    } else {
      const errorData = await response.json().catch(() => ({}));
      return json({
        valid: false,
        error: errorData.error?.message || 'Invalid API key',
      });
    }
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Test API key error:', e);
    throw error(500, 'Failed to test API key');
  }
};