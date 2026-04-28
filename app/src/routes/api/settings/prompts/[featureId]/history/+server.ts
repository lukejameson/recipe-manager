import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { PromptService } from '$lib/server/ai/prompt-service';
import { AIFeature } from '$lib/server/ai/features';

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

		const history = await PromptService.getPromptHistory(featureId as AIFeature);
		return json({ history });
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('Get prompt history error:', e);
		throw error(500, 'Internal server error');
	}
};
