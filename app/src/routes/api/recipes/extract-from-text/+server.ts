import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const schema = z.object({
	text: z.string().min(10).max(20000),
	sourceUrl: z.string().url().optional(),
});

interface RecipeItem {
	id: string;
	text: string;
	order: number;
}

function stringsToItemList(strings: string[]): { items: RecipeItem[] } {
	return {
		items: strings
			.map((s) => s.trim())
			.filter((s) => s.length > 0)
			.map((text, i) => ({ id: randomUUID(), text, order: i })),
	};
}

function parseStructuredItems(items: any[]): { items: RecipeItem[] } {
	if (!Array.isArray(items)) return { items: [] };
	return {
		items: items.map((item, i) => ({
			id: item.id || randomUUID(),
			text: typeof item === 'string' ? item : item.text,
			order: item.order ?? i,
		})),
	};
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const body = await request.json();
		const result = schema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { text, sourceUrl } = result.data;

		const aiService = await AIServiceV2.getInstance();

		const systemPrompt = `Extract a recipe from the following text. The text may be an Instagram caption, a blog post, a copied recipe, or any informal recipe description.
Return a JSON object with:
- title: string
- description: string — ALWAYS include a 1-3 sentence description of the recipe. Capture what makes it special, its flavor profile, or key characteristics. If the text has any commentary or context, weave that into the description.
- ingredients: array of objects with id (UUID), text (string), and order (number)
- instructions: array of objects with id (UUID), text (string), and order (number) — infer steps from the text even if not explicitly numbered
- prepTime: number (minutes, optional)
- cookTime: number (minutes, optional)
- servings: number (optional)
- notes: string (optional)
For instructions, if the text only has a single description like "airfry at 190c for 15 minutes", expand that into clear step-by-step instructions.`;

		const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_GENERATION, {
			systemPrompt,
			messages: [{ role: 'user', content: `Extract the recipe from this text:\n\n${text}` }],
			jsonMode: true,
		});

		let recipeData: Record<string, unknown>;
		try {
			const jsonMatch = generationResult.content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				recipeData = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
			} else {
				throw new Error('No JSON in AI response');
			}
		} catch {
			throw error(500, 'Failed to parse recipe from text');
		}

		const processedData: Record<string, unknown> = { ...recipeData };

		if (recipeData.ingredients) {
			if (Array.isArray(recipeData.ingredients) && recipeData.ingredients.length > 0) {
				const first = recipeData.ingredients[0];
				processedData.ingredients = typeof first === 'string'
					? stringsToItemList(recipeData.ingredients as string[])
					: parseStructuredItems(recipeData.ingredients as any[]);
			} else {
				processedData.ingredients = { items: [] };
			}
		}

		if (recipeData.instructions) {
			if (Array.isArray(recipeData.instructions) && recipeData.instructions.length > 0) {
				const first = recipeData.instructions[0];
				processedData.instructions = typeof first === 'string'
					? stringsToItemList(recipeData.instructions as string[])
					: parseStructuredItems(recipeData.instructions as any[]);
			} else {
				processedData.instructions = { items: [] };
			}
		}

		return json({
			...processedData,
			...(sourceUrl ? { sourceUrl } : {}),
			extracted: true,
		});
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Extract from text error:', e);
		throw error(500, 'Failed to extract recipe from text');
	}
};
