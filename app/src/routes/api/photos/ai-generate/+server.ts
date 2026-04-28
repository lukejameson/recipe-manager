import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { getStorageProviderForUser, getAdminIdForUser, getStorageConfigForUser } from '$lib/server/storage/service';
import { imageProcessor } from '$lib/server/storage/image-processor';
import { db } from '$lib/server/db/db';
import { photos } from '$lib/server/db/schema';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { providerRegistry } from '$lib/server/ai/providers/index.js';
import { AIConfigurationError, AIRateLimitError } from '$lib/utils/errors';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { join } from 'path';

const aiGenerateSchema = z.object({
	recipeId: z.string().optional(),
	title: z.string().min(1),
	description: z.string().optional(),
	ingredients: z.array(z.string()),
	tags: z.array(z.string()).optional()
});

async function getImagePromptTemplate(): Promise<string> {
	try {
		const templatePath = join(process.cwd(), 'docs', 'Image_gen_prompt.md');
		return await readFile(templatePath, 'utf-8');
	} catch {
		return `You are a food photography art director for "Marrow", a recipe app with a clean, cozy, and modern aesthetic.
Focus ONLY on the food in its bowl or plate. Apply Marrow visual identity: warm neutrals, soft natural lighting, matte ceramic.
STRICT RULES - NEVER include: cutlery, tablecloths, hands, text, logos, props. Aspect ratio 4:3 or 1:1. Photorealistic.`;
	}
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const tempStorageKeys: string[] = [];
	let userId: string = '';
	let adminId: string = '';

	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}
		userId = user.userId;
		adminId = await getAdminIdForUser(userId);

		const body = await request.json();
		const result = aiGenerateSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { recipeId, title, description, ingredients, tags } = result.data;

		const storageConfig = await getStorageConfigForUser(userId);
		if (!storageConfig) {
			throw error(400, 'No storage configured for this account');
		}

		const storageProvider = await getStorageProviderForUser(adminId);
		if (!storageProvider) {
			throw error(500, 'Storage provider not available');
		}

		const aiService = await AIServiceV2.getInstance();

		const promptConfig = await aiService.getFeatureConfig(AIFeature.IMAGE_PROMPT_GENERATION);
		if (!promptConfig) {
			throw new AIConfigurationError('No configuration found for image prompt generation. Please configure in Settings.');
		}

		const imagePromptApiKey = await aiService.getApiKey(promptConfig.providerId);
		if (!imagePromptApiKey) {
			throw new AIConfigurationError(`No API key configured for prompt provider: ${promptConfig.providerId}`);
		}

		const systemPrompt = await getImagePromptTemplate();
		const userMessage = `Dish: ${title}${description ? `\nDescription: ${description}` : ''}${ingredients.length > 0 ? `\nIngredients: ${ingredients.join(', ')}` : ''}${tags && tags.length > 0 ? `\nTags: ${tags.join(', ')}` : ''}`;

		const promptResult = await aiService.generateForFeature(AIFeature.IMAGE_PROMPT_GENERATION, {
			messages: [{ role: 'user', content: userMessage }],
			systemPrompt
		});

		const generatedPrompt = promptResult.content.trim();

		const imageConfig = await aiService.getFeatureConfig(AIFeature.IMAGE_GENERATION);
		if (!imageConfig) {
			throw new AIConfigurationError('No configuration found for image generation. Please configure in Settings.');
		}

		const imageApiKey = await aiService.getApiKey(imageConfig.providerId);
		if (!imageApiKey) {
			throw new AIConfigurationError(`No API key configured for image provider: ${imageConfig.providerId}`);
		}

		const imageProvider = providerRegistry.get(imageConfig.providerId);
		if (!imageProvider) {
			throw new AIConfigurationError(`Provider not found: ${imageConfig.providerId}`);
		}
		if (!('generateImage' in imageProvider)) {
			throw new AIConfigurationError(`Provider ${imageConfig.providerId} (${imageProvider.name}) does not support image generation. Currently only Google/Gemini supports image generation. Please configure Google as the image generation provider in Settings > Features.`);
		}

		if (!('generateImage' in imageProvider)) {
			throw new AIConfigurationError(`Provider ${imageConfig.providerId} (${imageProvider.name}) does not support image generation. Please configure a provider with image generation support (Google/Gemini or OpenRouter with image models) in Settings > Features.`);
		}
		const imageResult = await (imageProvider as any).generateImage({
			apiKey: imageApiKey,
			model: imageConfig.modelId,
			prompt: generatedPrompt,
			aspectRatio: '1:1'
		});

		const imageBuffer = Buffer.from(imageResult.imageData, 'base64');
		const processed = await imageProcessor.processImage(imageBuffer);

		const timestamp = Date.now();
		const baseKey = `ai-generated/${userId}/${timestamp}`;
		const originalKey = `${baseKey}.webp`;
		const thumbnailKey = `${baseKey}_thumb.webp`;
		const mediumKey = `${baseKey}_medium.webp`;

		tempStorageKeys.push(originalKey, thumbnailKey, mediumKey);

		await storageProvider.uploadBuffer(thumbnailKey, processed.thumbnail.buffer, 'image/webp');
		await storageProvider.uploadBuffer(mediumKey, processed.medium.buffer, 'image/webp');
		await storageProvider.uploadBuffer(originalKey, processed.original.buffer, 'image/webp');

		const [newPhoto] = await db.insert(photos).values({
			accountId: userId,
			adminId,
			recipeId: recipeId || null,
			originalKey,
			thumbnailKey,
			mediumKey,
			originalSize: processed.original.size,
			mimeType: 'image/webp',
			width: processed.original.width,
			height: processed.original.height
		}).returning();

		const [originalUrl, thumbnailUrl, mediumUrl] = await Promise.all([
			storageProvider.getDownloadUrl(newPhoto, 'original'),
			storageProvider.getDownloadUrl(newPhoto, 'thumbnail'),
			storageProvider.getDownloadUrl(newPhoto, 'medium')
		]);

		return json({
			id: newPhoto.id,
			originalKey: newPhoto.originalKey,
			thumbnailKey: newPhoto.thumbnailKey,
			mediumKey: newPhoto.mediumKey,
			width: newPhoto.width,
			height: newPhoto.height,
			mimeType: newPhoto.mimeType,
			urls: {
				original: originalUrl,
				thumbnail: thumbnailUrl,
				medium: mediumUrl
			}
		});
	} catch (e) {
		if (tempStorageKeys.length > 0 && adminId) {
			const storageProvider = await getStorageProviderForUser(adminId).catch(() => null);
			if (storageProvider) {
				await Promise.allSettled(
					tempStorageKeys.map(key => storageProvider.deleteKey(key))
				);
			}
		}
		if (typeof e === 'object' && e !== null && 'status' in e) throw e;
		if (e instanceof AIRateLimitError) {
			throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
		}
		if (e instanceof AIConfigurationError) {
			throw error(503, (e as AIConfigurationError).message);
		}
		console.error('AI generate photo error:', e);
		throw error(500, 'Failed to generate photo');
	}
};
