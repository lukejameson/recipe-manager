import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { featureModelConfigs, providerConfigs } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { AIFeature, DEFAULT_FEATURE_CONFIGS, FEATURE_NAMES, FEATURE_DESCRIPTIONS, FEATURE_CATEGORIES, CATEGORY_NAMES } from '$lib/server/ai/features';
import { providerRegistry } from '$lib/server/ai/providers';

// GET /api/settings/feature-configs - Get all feature configurations
export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);

		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		// Get all feature configs with provider info
		const configs = await db
			.select({
				id: featureModelConfigs.id,
				featureId: featureModelConfigs.featureId,
				providerId: featureModelConfigs.providerId,
				modelId: featureModelConfigs.modelId,
				temperature: featureModelConfigs.temperature,
				maxTokens: featureModelConfigs.maxTokens,
				isEnabled: featureModelConfigs.isEnabled,
				priority: featureModelConfigs.priority
			})
			.from(featureModelConfigs)
			.orderBy(desc(featureModelConfigs.priority));

		// Get available providers with their models
		const providerData = await db
			.select({
				providerId: providerConfigs.providerId,
				isEnabled: providerConfigs.isEnabled
			})
			.from(providerConfigs)
			.where(eq(providerConfigs.isEnabled, true));

		const enabledProviders = new Set(providerData.map(p => p.providerId));

		// Build response with metadata
		const features = Object.values(AIFeature).map(feature => {
			const config = configs.find(c => c.featureId === feature);
			const defaults = DEFAULT_FEATURE_CONFIGS[feature];

			return {
				id: feature,
				name: FEATURE_NAMES[feature],
				description: FEATURE_DESCRIPTIONS[feature],
				category: FEATURE_CATEGORIES[feature],
				categoryName: CATEGORY_NAMES[FEATURE_CATEGORIES[feature]],
				requiresVision: defaults.requiresVision,
				defaultTemperature: defaults.temperature,
				defaultMaxTokens: defaults.maxTokens,
				config: config ? {
					id: config.id,
					providerId: config.providerId,
					modelId: config.modelId,
					temperature: config.temperature !== null ? config.temperature / 100 : defaults.temperature,
					maxTokens: config.maxTokens ?? defaults.maxTokens,
					enabled: config.isEnabled,
					priority: config.priority
				} : null
			};
		});

		return json({
			features,
			providers: providerData.filter(p => enabledProviders.has(p.providerId))
		});
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Get feature configs error:', e);
		throw error(500, 'Internal server error');
	}
};

// POST /api/settings/feature-configs - Create or update a feature config
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);

		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const body = await request.json();

		const schema = z.object({
			featureId: z.nativeEnum(AIFeature),
			providerId: z.string().min(1),
			modelId: z.string().min(1),
			temperature: z.number().min(0).max(2).optional(),
			maxTokens: z.number().int().min(1).max(128000).optional(),
			isEnabled: z.boolean().default(true),
			priority: z.number().int().default(0)
		});

		const result = schema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { featureId, providerId, modelId, temperature, maxTokens, isEnabled, priority } = result.data;

		// Validate provider exists and is configured
		const providerConfig = await db
			.select()
			.from(providerConfigs)
			.where(eq(providerConfigs.providerId, providerId))
			.limit(1);

		if (!providerConfig.length) {
			throw error(400, `Provider ${providerId} is not configured`);
		}

		// Validate provider supports this feature
		const provider = providerRegistry.get(providerId);
		if (!provider) {
			throw error(400, `Unknown provider: ${providerId}`);
		}

		const defaults = DEFAULT_FEATURE_CONFIGS[featureId];

		// Check vision requirement
		if (defaults.requiresVision && !provider.supportsVision) {
			throw error(400, `Feature ${featureId} requires vision support, but ${providerId} does not support vision`);
		}

		// Convert temperature to integer (multiply by 100) for storage
		const tempForStorage = temperature !== undefined ? Math.round(temperature * 100) : null;

		// Check if config already exists
		const [existing] = await db
			.select()
			.from(featureModelConfigs)
			.where(eq(featureModelConfigs.featureId, featureId))
			.limit(1);

		if (existing) {
			// Update existing
			await db
				.update(featureModelConfigs)
				.set({
					providerId,
					modelId,
					temperature: tempForStorage,
					maxTokens: maxTokens ?? null,
					isEnabled,
					priority,
					updatedAt: new Date()
				})
				.where(eq(featureModelConfigs.id, existing.id));

			return json({
				success: true,
				id: existing.id,
				message: 'Feature configuration updated successfully'
			});
		} else {
			// Create new
			const id = crypto.randomUUID();
			await db.insert(featureModelConfigs).values({
				id,
				featureId,
				providerId,
				modelId,
				temperature: tempForStorage,
				maxTokens: maxTokens ?? null,
				isEnabled,
				priority,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			return json({
				success: true,
				id,
				message: 'Feature configuration created successfully'
			});
		}
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Save feature config error:', e);
		throw error(500, 'Internal server error');
	}
};

// DELETE /api/settings/feature-configs - Delete a feature config
export const DELETE: RequestHandler = async ({ url, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);

		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const featureId = url.searchParams.get('featureId');
		if (!featureId) {
			throw error(400, 'featureId is required');
		}

		// Delete the feature config
		await db
			.delete(featureModelConfigs)
			.where(eq(featureModelConfigs.featureId, featureId));

		return json({ success: true, message: 'Feature configuration removed' });
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Delete feature config error:', e);
		throw error(500, 'Internal server error');
	}
};
