import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { providerRegistry } from '$lib/server/ai/providers/index.js';
import { decrypt } from '$lib/server/utils/encryption';
import { AIConfigurationError, isAIConfigurationError } from '$lib/utils/errors';

const generateImageSchema = z.object({
	prompt: z.string().min(1)
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const body = await request.json();
		const result = generateImageSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { prompt } = result.data;

		const aiService = await AIServiceV2.getInstance();
		const config = await aiService.getFeatureConfig(AIFeature.IMAGE_GENERATION);

		if (!config) {
			throw new AIConfigurationError('No configuration found for image generation. Please configure in Settings.');
		}

		const apiKey = await aiService.getApiKey(config.providerId);
		if (!apiKey) {
			throw new AIConfigurationError(`No API key configured for provider: ${config.providerId}`);
		}

		const provider = providerRegistry.get(config.providerId);
		if (!provider) {
			throw new AIConfigurationError(`Provider not found: ${config.providerId}`);
		}

		if (!('generateImage' in provider)) {
			throw new AIConfigurationError(`Provider ${config.providerId} (${provider.name}) does not support image generation. Currently only Google/Gemini supports image generation. Please configure Google as the image generation provider in Settings > Features.`);
		}

		const imageProvider = provider as any;
		const imageResult = await imageProvider.generateImage({
			apiKey,
			model: config.modelId,
			prompt,
			aspectRatio: '1:1'
		});

		return json({
			imageData: imageResult.imageData,
			mimeType: imageResult.mimeType,
			width: imageResult.width,
			height: imageResult.height
		});
	} catch (e) {
		if (typeof e === 'object' && e !== null && 'status' in e) throw e;
		if (e instanceof AIConfigurationError) {
			throw error(503, e.message);
		}
		console.error('Generate image error:', e);
		throw error(500, 'Failed to generate image');
	}
};
