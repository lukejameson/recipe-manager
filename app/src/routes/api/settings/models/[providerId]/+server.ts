import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { providerConfigs } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { providerRegistry } from '$lib/server/ai/providers';
import { decrypt } from '$lib/server/utils/encryption';

// GET /api/settings/models/[providerId] - Get available models for a provider
export const GET: RequestHandler = async ({ params, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);

		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const { providerId } = params;
		if (!providerId) {
			throw error(400, 'Provider ID is required');
		}

		// Get provider config
		const [config] = await db
			.select()
			.from(providerConfigs)
			.where(eq(providerConfigs.providerId, providerId))
			.limit(1);

		if (!config) {
			throw error(404, `Provider ${providerId} is not configured`);
		}

		// Decrypt API key
		let apiKey = config.apiKey || '';
		try {
			apiKey = decrypt(apiKey);
		} catch {
			// If decryption fails, use as-is
		}

		if (!apiKey) {
			throw error(400, 'No API key configured for this provider');
		}

		// Get provider and fetch models
		const provider = providerRegistry.get(providerId);
		if (!provider) {
			throw error(400, `Unknown provider: ${providerId}`);
		}

		try {
			const models = await provider.fetchModels(apiKey);
			return json({
				providerId,
				models: models.map(m => ({
					id: m.id,
					name: m.name,
					contextWindow: m.contextWindow,
					supportsVision: m.supportsVision,
					supportsJsonMode: m.supportsJsonMode,
					pricing: m.pricing
				}))
			});
		} catch (err) {
			console.error('Failed to fetch models:', err);
			throw error(502, 'Failed to fetch models from provider');
		}
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Get models error:', e);
		throw error(500, 'Internal server error');
	}
};
