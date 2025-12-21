import { aiService } from './index.js';

export interface TechniqueInput {
  term: string;
  context?: string;
}

export interface TechniqueExplanation {
  term: string;
  definition: string;
  steps?: string[];
  tips?: string[];
}

const TECHNIQUE_SYSTEM_PROMPT = `You are a culinary instructor explaining cooking techniques and terms to home cooks.

Given a cooking term, provide a clear, helpful explanation.

Return ONLY a valid JSON object:
{
  "term": "the term being explained",
  "definition": "clear 1-2 sentence definition",
  "steps": ["step 1", "step 2"] (optional, for techniques that have steps),
  "tips": ["tip 1", "tip 2"] (optional, 1-3 helpful tips)
}

Guidelines:
- Keep definitions concise but complete
- Steps should be practical and actionable
- Tips should help avoid common mistakes
- Use simple language accessible to beginners
- Return ONLY the JSON object, no other text`;

export async function explainTechnique(input: TechniqueInput): Promise<TechniqueExplanation> {
  const { term, context } = input;

  const userPrompt = `Explain this cooking term: "${term}"
${context ? `\nContext from recipe: "${context}"` : ''}

Return the explanation as JSON.`;

  const result = await aiService.complete({
    systemPrompt: TECHNIQUE_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 512,
    temperature: 0.2,
  });

  try {
    let jsonStr = result.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const explanation = JSON.parse(jsonStr);

    const result_obj: TechniqueExplanation = {
      term: String(explanation.term || term).slice(0, 100),
      definition: String(explanation.definition || '').slice(0, 500),
    };

    if (Array.isArray(explanation.steps) && explanation.steps.length > 0) {
      result_obj.steps = explanation.steps
        .filter((s: any) => typeof s === 'string')
        .map((s: string) => s.slice(0, 300))
        .slice(0, 10);
    }

    if (Array.isArray(explanation.tips) && explanation.tips.length > 0) {
      result_obj.tips = explanation.tips
        .filter((t: any) => typeof t === 'string')
        .map((t: string) => t.slice(0, 300))
        .slice(0, 5);
    }

    return result_obj;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse technique explanation from AI response.');
    }
    throw error;
  }
}
