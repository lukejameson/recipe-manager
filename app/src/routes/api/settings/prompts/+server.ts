import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { PromptService } from '$lib/server/ai/prompt-service';
import { AIFeature } from '$lib/server/ai/features';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const prompts = await PromptService.getAllPrompts();
		return json({ prompts });
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Get prompts error:', e);
		throw error(500, 'Internal server error');
	}
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const body = await request.json();
		const { query } = body;

		if (!query || typeof query !== 'string') {
			throw error(400, 'Search query is required');
		}

		const prompts = await PromptService.searchPrompts(query);
		return json({ prompts });
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Search prompts error:', e);
		throw error(500, 'Internal server error');
	}
};
