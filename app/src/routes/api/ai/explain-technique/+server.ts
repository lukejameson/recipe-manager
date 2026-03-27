import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';

const explainTechniqueSchema = z.object({
  term: z.string().min(1),
  context: z.string().optional(),
});

// POST /api/ai/explain-technique - Explain a cooking technique
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = explainTechniqueSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { term, context } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    const userPrompt = `Explain the cooking technique "${term}"${context ? ` in the context of: ${context}` : ''}.

Return a JSON object with:
- term: string (the technique name)
- definition: string (clear explanation)
- steps: array of strings (step-by-step how to do it)
- tips: array of strings (pro tips and common pitfalls)`;

    const generationResult = await aiService.generateForFeature(AIFeature.TECHNIQUE_EXPLANATION, {
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = generationResult.content;

    let explanation: Record<string, unknown>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        explanation = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } else {
        explanation = {
          term,
          definition: content.substring(0, 500),
          steps: [],
          tips: [],
        };
      }
    } catch {
      explanation = {
        term,
        definition: 'Unable to parse explanation.',
        steps: [],
        tips: [],
      };
    }

    return json(explanation);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Explain technique error:', e);
    throw error(500, 'Failed to explain technique');
  }
};