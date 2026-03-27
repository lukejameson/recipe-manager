import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import {
	providerRegistry,
	OpenAICompatibleProvider
} from '$lib/server/ai/providers';

// POST /api/settings/test-provider - Test a provider configuration
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);

		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const body = await request.json();

		const schema = z.object({
			providerId: z.string().min(1),
			apiKey: z.string().min(1),
			baseUrl: z.string().optional()
		});

		const result = schema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { providerId, apiKey, baseUrl } = result.data;

		// Get provider
		const provider = providerRegistry.get(providerId);
		if (!provider) {
			throw error(400, `Unknown provider: ${providerId}`);
		}

		// Test the configuration
		const startTime = Date.now();
		let isValid: boolean;
		let errorMessage: string | undefined;
		let models: Array<{
			id: string;
			name: string;
			contextWindow: number;
			supportsVision: boolean;
			supportsJsonMode: boolean;
		}> = [];

		try {
			if (providerId === 'openai-compatible' && baseUrl) {
				const compatibleProvider = new OpenAICompatibleProvider(baseUrl);
				isValid = await compatibleProvider.validateApiKey(apiKey, baseUrl);
				if (!isValid) {
					errorMessage = 'Invalid API key or base URL';
				} else {
					// Fetch models for OpenAI-compatible provider
					try {
						models = await compatibleProvider.fetchModels(apiKey);
					} catch {
						// Ignore model fetch errors
					}
				}
			} else {
				isValid = await provider.validateApiKey(apiKey);
				if (!isValid) {
					errorMessage = 'Invalid API key';
				} else {
					// Fetch models for the provider
					try {
						models = await provider.fetchModels(apiKey);
					} catch {
						// Ignore model fetch errors
					}
				}
			}
		} catch (err) {
			isValid = false;
			errorMessage = err instanceof Error ? err.message : 'Connection failed';
		}

		const responseTime = Date.now() - startTime;

		return json({
			success: isValid,
			responseTime,
			error: errorMessage,
			models: models.length > 0 ? models : undefined,
			provider: {
				id: provider.id,
				name: provider.name,
				supportsVision: provider.supportsVision,
				supportsStreaming: provider.supportsStreaming
			}
		});
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Test provider error:', e);
		throw error(500, 'Internal server error');
	}
};
