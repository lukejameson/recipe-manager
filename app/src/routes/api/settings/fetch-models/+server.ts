import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';

const fetchModelsSchema = z.object({
  apiKey: z.string().min(1),
});

// Available Anthropic models
const DEFAULT_MODELS = [
  { id: 'claude-opus-4-20250514', name: 'Claude 4 Opus' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet' },
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (Legacy)' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
];

// POST /api/settings/fetch-models - Fetch available models from Anthropic
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = fetchModelsSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { apiKey } = result.data;

    // Fetch models from Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw error(400, errorData.error?.message || 'Failed to fetch models');
    }

    const data = await response.json();

    // Map API response to our format
    const models = data.data?.map((model: any) => ({
      id: model.id,
      name: model.display_name || model.id,
    })) || DEFAULT_MODELS;

    return json({ models });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Fetch models error:', e);
    // Return default models on error
    return json({ models: DEFAULT_MODELS });
  }
};