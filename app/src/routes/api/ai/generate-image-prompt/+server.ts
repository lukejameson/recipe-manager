import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { PromptService } from '$lib/server/ai/prompt-service';
import { AIConfigurationError, isAIConfigurationError, AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';
import { z } from 'zod';

const generatePromptSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	ingredients: z.array(z.string()),
	tags: z.array(z.string()).optional()
});

async function getImagePromptTemplate(): Promise<string> {
	const promptData = await PromptService.getPrompt(AIFeature.IMAGE_PROMPT_GENERATION);
	if (promptData?.content) {
		return promptData.content;
	}
	return `You are a food photography art director for "Marrow", a recipe app with a clean, cozy, and modern aesthetic.
Focus ONLY on the food in its bowl or plate. Apply Marrow visual identity: warm neutrals, soft natural lighting, matte ceramic.
STRICT RULES - NEVER include: cutlery, tablecloths, hands, text, logos, props. Aspect ratio 4:3 or 1:1. Photorealistic.`;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const body = await request.json();
		const result = generatePromptSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { title, description, ingredients, tags } = result.data;

		const aiService = await AIServiceV2.getInstance();
		const systemPrompt = await getImagePromptTemplate();

		const userMessage = `Dish: ${title}${description ? `\nDescription: ${description}` : ''}${ingredients.length > 0 ? `\nIngredients: ${ingredients.join(', ')}` : ''}${tags && tags.length > 0 ? `\nTags: ${tags.join(', ')}` : ''}`;

		const generationResult = await aiService.generateForFeature(AIFeature.IMAGE_PROMPT_GENERATION, {
			messages: [{ role: 'user', content: userMessage }],
			systemPrompt
		});

		const generatedPrompt = generationResult.content.trim();
		return json({ prompt: generatedPrompt });
	} catch (e) {
		if (typeof e === 'object' && e !== null && 'status' in e) throw e;
		if (e instanceof AIRateLimitError) {
			throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
		}
		if (e instanceof AIConfigurationError) {
			throw error(503, e.message);
		}
		console.error('Generate image prompt error:', e);
		throw error(500, 'Failed to generate image prompt');
	}
};
