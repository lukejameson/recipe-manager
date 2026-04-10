import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { db } from '$lib/server/db/db';
import { settings, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '$lib/server/utils/encryption';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const importInstagramSchema = z.object({
	url: z.string().url(),
});

const INSTAGRAM_URL_RE = /instagram\.com\/(p|reel|reels)\/([A-Za-z0-9_-]+)/;

interface RecipeItem {
	id: string;
	text: string;
	order: number;
	checked?: boolean;
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

function extractCaptionFromHtml(html: string): string {
	const match = html.match(/<p>([\s\S]*?)<\/p>/i);
	if (!match) return '';
	return match[1]
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.trim();
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const body = await request.json();
		const result = importInstagramSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { url } = result.data;

		if (!INSTAGRAM_URL_RE.test(url)) {
			throw error(400, 'URL must be an Instagram post or reel (instagram.com/p/... or instagram.com/reel/...)');
		}

		const [appSettings] = await db
			.select()
			.from(settings)
			.where(eq(settings.id, 'app-settings'))
			.limit(1);

		if (!appSettings?.instagramAppId || !appSettings?.instagramAppSecret) {
			throw error(400, 'Instagram import is not configured. Ask your admin to add the App ID and App Secret in Settings → Instagram.');
		}

		let appId: string;
		let appSecret: string;
		try {
			appId = decrypt(appSettings.instagramAppId);
			appSecret = decrypt(appSettings.instagramAppSecret);
		} catch {
			appId = appSettings.instagramAppId;
			appSecret = appSettings.instagramAppSecret;
		}

		const accessToken = `${appId}|${appSecret}`;

		const cleanUrl = new URL(url);
		cleanUrl.search = '';
		const canonicalUrl = cleanUrl.toString();

		const oembedUrl = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(canonicalUrl)}&access_token=${encodeURIComponent(accessToken)}&omitscript=true`;

		const oembedRes = await fetch(oembedUrl, {
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarrowBot/1.0)' },
		});

		if (!oembedRes.ok) {
			const errBody = await oembedRes.text().catch(() => '');
			console.error('Instagram oEmbed API error:', oembedRes.status, errBody);
			let fbMessage = '';
			try {
				const parsed = JSON.parse(errBody);
				fbMessage = parsed?.error?.message || parsed?.message || '';
			} catch {}
			if (oembedRes.status === 400 || oembedRes.status === 401 || oembedRes.status === 403) {
				throw error(400, `Instagram API error: ${fbMessage || oembedRes.status}. Check your App ID and App Secret in Settings.`);
			}
			if (oembedRes.status === 404) {
				throw error(400, 'Instagram post not found. Make sure the post is public.');
			}
			throw error(502, `Instagram API error: ${oembedRes.status} — ${fbMessage}`);
		}

		const oembedData = await oembedRes.json() as {
			title?: string;
			author_name?: string;
			html?: string;
			thumbnail_url?: string;
			thumbnail_width?: number;
			thumbnail_height?: number;
		};

		const caption = oembedData.html ? extractCaptionFromHtml(oembedData.html) : (oembedData.title ?? '');
		const thumbnailUrl = oembedData.thumbnail_url;

		if (!thumbnailUrl) {
			throw error(400, 'Could not retrieve post image. The post may be private or a video without a thumbnail.');
		}

		const imgRes = await fetch(thumbnailUrl);
		if (!imgRes.ok) {
			throw error(502, 'Failed to download post image');
		}
		const imgBuffer = await imgRes.arrayBuffer();
		const base64Image = Buffer.from(imgBuffer).toString('base64');
		const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
		const mimeType = contentType.startsWith('image/png') ? 'image/png' : 'image/jpeg';

		const aiService = await AIServiceV2.getInstance();

		const systemPrompt = `Extract recipe information from the provided image and caption text from an Instagram post.
The caption may contain the full recipe including ingredients and instructions — prioritise text from the caption for accuracy.
Return a JSON object with:
- title: string
- description: string (optional)
- ingredients: array of objects with id (optional UUID), text (string), and order (optional number)
- instructions: array of objects with id (optional UUID), text (string), and order (optional number)
- prepTime: number (minutes, optional)
- cookTime: number (minutes, optional)
- servings: number (optional)
- notes: string (optional)
Only include fields you can confidently extract.`;

		const userMessage = caption
			? `Caption from Instagram post:\n\n${caption}\n\nExtract the recipe from the caption and image above.`
			: 'Extract the recipe from this Instagram post image.';

		const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_FROM_INSTAGRAM, {
			systemPrompt,
			messages: [{ role: 'user', content: userMessage }],
			images: [{ mimeType, data: base64Image }],
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
			throw error(500, 'Failed to parse recipe data from Instagram post');
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
			sourceUrl: url,
			extracted: true,
		});
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Instagram import error:', e);
		throw error(500, 'Failed to import recipe from Instagram');
	}
};
