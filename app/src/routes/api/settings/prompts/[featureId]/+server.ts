import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { PromptService } from '$lib/server/ai/prompt-service';
import { AIFeature } from '$lib/server/ai/features';
import { z } from 'zod';

const updateSchema = z.object({
	content: z.string().min(1)
});

const resetSchema = z.object({
	confirm: z.literal(true)
});

export const GET: RequestHandler = async ({ params, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const featureId = params.featureId;
		if (!featureId || !Object.values(AIFeature).includes(featureId as AIFeature)) {
			throw error(400, 'Invalid feature ID');
		}

		const prompt = await PromptService.getPrompt(featureId as AIFeature);
		if (!prompt) {
			throw error(404, 'Prompt not found');
		}

		return json({ prompt });
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Get prompt error:', e);
		throw error(500, 'Internal server error');
	}
};

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const featureId = params.featureId;
		if (!featureId || !Object.values(AIFeature).includes(featureId as AIFeature)) {
			throw error(400, 'Invalid feature ID');
		}

		const body = await request.json();
		const result = updateSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const prompt = await PromptService.updatePrompt(
			featureId as AIFeature,
			result.data.content,
			user.id
		);

		return json({ success: true, prompt });
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Update prompt error:', e);
		throw error(500, 'Internal server error');
	}
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const featureId = params.featureId;
		if (!featureId || !Object.values(AIFeature).includes(featureId as AIFeature)) {
			throw error(400, 'Invalid feature ID');
		}

		const body = await request.json();
		const result = resetSchema.safeParse(body);
		if (!result.success) {
			throw error(400, 'Invalid reset request. Must confirm with { confirm: true }');
		}

		const prompt = await PromptService.resetToDefault(featureId as AIFeature, user.id);
		if (!prompt) {
			throw error(404, 'No default prompt found for this feature');
		}

		return json({ success: true, prompt });
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Reset prompt error:', e);
		throw error(500, 'Internal server error');
	}
};
