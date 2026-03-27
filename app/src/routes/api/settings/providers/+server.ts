import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { providerConfigs } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { encrypt } from '$lib/server/utils/encryption';
import { providerRegistry, OpenAICompatibleProvider } from '$lib/server/ai/providers';
import { AIServiceV2 } from '$lib/server/ai/service-v2.js';

// Provider ID validation
const providerIdSchema = z.enum(['anthropic', 'openai', 'google', 'openrouter', 'openai-compatible']);

// GET /api/settings/providers - List all configured providers
export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);

		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		// Initialize AIServiceV2 to register providers
		await AIServiceV2.getInstance();

		const configs = await db
			.select({
				id: providerConfigs.id,
				providerId: providerConfigs.providerId,
				baseUrl: providerConfigs.baseUrl,
				isEnabled: providerConfigs.isEnabled,
				createdAt: providerConfigs.createdAt,
				updatedAt: providerConfigs.updatedAt
			})
			.from(providerConfigs);

		// Get all registered providers with their capabilities
		const allProviders = providerRegistry.getAll().map(p => ({
			id: p.id,
			name: p.name,
			supportsVision: p.supportsVision,
			supportsStreaming: p.supportsStreaming
		}));

		// Merge configured status with all providers
		const configuredProviderIds = new Set(configs.map(c => c.providerId));

		return json({
			providers: allProviders,
			configured: configs.map(c => ({
				...c,
				hasApiKey: true // We don't expose if key exists, just that it's configured
			})),
			unconfigured: allProviders.filter(p => !configuredProviderIds.has(p.id))
		});
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Get providers error:', e);
		throw error(500, 'Internal server error');
	}
};

// POST /api/settings/providers - Add or update a provider
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);

		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const body = await request.json();

		const schema = z.object({
			providerId: providerIdSchema,
			apiKey: z.string().min(1),
			baseUrl: z.string().optional(),
			isEnabled: z.boolean().default(true)
		});

		const result = schema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { providerId, apiKey, baseUrl, isEnabled } = result.data;

		// Validate the API key before saving
		const provider = providerRegistry.get(providerId);
		if (!provider) {
			throw error(400, `Unknown provider: ${providerId}`);
		}

		let isValid: boolean;
		if (providerId === 'openai-compatible' && baseUrl) {
			const compatibleProvider = new OpenAICompatibleProvider(baseUrl);
			isValid = await compatibleProvider.validateApiKey(apiKey, baseUrl);
		} else {
			isValid = await provider.validateApiKey(apiKey);
		}

		if (!isValid) {
			throw error(400, 'Invalid API key');
		}

		// Encrypt the API key before saving
		const encryptedKey = encrypt(apiKey);

		// Check if provider config already exists
		const [existing] = await db
			.select()
			.from(providerConfigs)
			.where(eq(providerConfigs.providerId, providerId))
			.limit(1);

		if (existing) {
			// Update existing
			await db
				.update(providerConfigs)
				.set({
					apiKey: encryptedKey,
					baseUrl: baseUrl || null,
					isEnabled,
					updatedAt: new Date()
				})
				.where(eq(providerConfigs.id, existing.id));

			return json({
				success: true,
				id: existing.id,
				message: 'Provider updated successfully'
			});
		} else {
			// Create new
			const id = crypto.randomUUID();
			await db.insert(providerConfigs).values({
				id,
				providerId,
				apiKey: encryptedKey,
				baseUrl: baseUrl || null,
				isEnabled,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			return json({
				success: true,
				id,
				message: 'Provider added successfully'
			});
		}
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Save provider error:', e);
		throw error(500, 'Internal server error');
	}
};

// DELETE /api/settings/providers - Delete a provider config
export const DELETE: RequestHandler = async ({ url, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);

		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const providerId = url.searchParams.get('providerId');
		if (!providerId) {
			throw error(400, 'providerId is required');
		}

		// Delete the provider config
		await db
			.delete(providerConfigs)
			.where(eq(providerConfigs.providerId, providerId));

		return json({ success: true, message: 'Provider removed successfully' });
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Delete provider error:', e);
		throw error(500, 'Internal server error');
	}
};
