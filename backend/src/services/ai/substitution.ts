import { aiService } from './index.js';

export interface SubstitutionInput {
  ingredient: string;
  context?: string;
  dietaryRestrictions?: string[];
}

export interface Substitution {
  substitute: string;
  ratio: string;
  notes: string;
  suitableFor: string[];
}

const SUBSTITUTION_SYSTEM_PROMPT = `You are a culinary expert helping home cooks find ingredient substitutions.

Given an ingredient, suggest practical alternatives with conversion ratios.

Return ONLY a valid JSON array of substitutions:
[
  {
    "substitute": "name of substitute ingredient",
    "ratio": "conversion ratio (e.g., '1:1', '2 tbsp per 1 cup')",
    "notes": "brief note on flavor/texture differences or best uses",
    "suitableFor": ["baking", "cooking", "sauces"] (what types of recipes this works in)
  }
]

Guidelines:
- Suggest 3-5 practical substitutes
- Consider common pantry items first
- Include at least one dietary-friendly option when possible
- Be specific about ratios
- Note any significant flavor or texture changes
- Return ONLY the JSON array, no other text`;

export async function suggestSubstitutions(input: SubstitutionInput): Promise<Substitution[]> {
  const { ingredient, context, dietaryRestrictions } = input;

  let userPrompt = `Suggest substitutes for: "${ingredient}"`;

  if (context) {
    userPrompt += `\n\nRecipe context: ${context}`;
  }

  if (dietaryRestrictions?.length) {
    userPrompt += `\n\nDietary requirements to consider: ${dietaryRestrictions.join(', ')}`;
  }

  userPrompt += '\n\nReturn substitution suggestions as JSON.';

  const result = await aiService.complete({
    systemPrompt: SUBSTITUTION_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 768,
    temperature: 0.3,
    useHaiku: true, // Simple suggestion task
  });

  try {
    let jsonStr = result.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const substitutions = JSON.parse(jsonStr);

    if (!Array.isArray(substitutions)) {
      throw new Error('Expected array of substitutions');
    }

    return substitutions
      .filter(
        (s: any) =>
          typeof s.substitute === 'string' &&
          typeof s.ratio === 'string' &&
          typeof s.notes === 'string'
      )
      .map((s: any) => ({
        substitute: String(s.substitute).slice(0, 100),
        ratio: String(s.ratio).slice(0, 50),
        notes: String(s.notes).slice(0, 300),
        suitableFor: Array.isArray(s.suitableFor)
          ? s.suitableFor.filter((x: any) => typeof x === 'string').slice(0, 5)
          : [],
      }))
      .slice(0, 8);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse substitution suggestions from AI response.');
    }
    throw error;
  }
}
