import { aiService } from './index.js';

export type AdaptationType =
  | 'vegan'
  | 'vegetarian'
  | 'gluten-free'
  | 'dairy-free'
  | 'low-carb'
  | 'keto'
  | 'nut-free'
  | 'low-sodium';

export interface AdaptationInput {
  recipe: {
    title: string;
    ingredients: string[];
    instructions: string[];
  };
  adaptationType: AdaptationType;
}

export interface AdaptationChange {
  original: string;
  replacement: string;
  reason: string;
}

export interface AdaptedRecipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  changes: AdaptationChange[];
  warnings: string[];
}

const ADAPTATION_SYSTEM_PROMPT = `You are a culinary expert specializing in dietary adaptations and allergen-free cooking.

Adapt recipes for specific dietary requirements while maintaining flavor and texture.

Return ONLY a valid JSON object:
{
  "title": "adapted recipe title (add dietary note in parentheses)",
  "ingredients": ["adapted ingredient list"],
  "instructions": ["adapted instructions if needed"],
  "changes": [
    {
      "original": "original ingredient/step",
      "replacement": "what it was replaced with",
      "reason": "why this substitution works"
    }
  ],
  "warnings": ["any important notes about texture, flavor, or cooking differences"]
}

Guidelines:
- Replace only what's necessary for the dietary requirement
- Maintain ratios and quantities where possible
- Note significant texture or flavor changes in warnings
- Keep instructions similar unless changes require different techniques
- If a dish fundamentally cannot be adapted, explain in warnings
- Return ONLY the JSON object, no other text`;

export async function adaptRecipe(input: AdaptationInput): Promise<AdaptedRecipe> {
  const { recipe, adaptationType } = input;

  const dietDescriptions: Record<AdaptationType, string> = {
    vegan: 'no animal products (no meat, dairy, eggs, honey)',
    vegetarian: 'no meat or fish (dairy and eggs are okay)',
    'gluten-free': 'no gluten (no wheat, barley, rye, or cross-contaminated oats)',
    'dairy-free': 'no dairy products (no milk, cheese, butter, cream)',
    'low-carb': 'reduced carbohydrates (minimize grains, sugar, starchy vegetables)',
    keto: 'very low carb, high fat (under 20g net carbs)',
    'nut-free': 'no tree nuts or peanuts',
    'low-sodium': 'reduced sodium (use herbs/spices instead of salt)',
  };

  const userPrompt = `Adapt this recipe to be ${adaptationType}:
${dietDescriptions[adaptationType]}

Title: ${recipe.title}

Ingredients:
${recipe.ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Instructions:
${recipe.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

Return the adapted recipe as JSON.`;

  const result = await aiService.complete({
    systemPrompt: ADAPTATION_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 2048,
    temperature: 0.3,
    useHaiku: true, // Rule-based substitution task
  });

  try {
    let jsonStr = result.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const adapted = JSON.parse(jsonStr);

    const adaptedRecipe: AdaptedRecipe = {
      title: String(adapted.title || `${recipe.title} (${adaptationType})`).slice(0, 200),
      ingredients: Array.isArray(adapted.ingredients)
        ? adapted.ingredients.filter((i: any) => typeof i === 'string').map((i: string) => i.slice(0, 500))
        : recipe.ingredients,
      instructions: Array.isArray(adapted.instructions)
        ? adapted.instructions.filter((i: any) => typeof i === 'string').map((i: string) => i.slice(0, 1000))
        : recipe.instructions,
      changes: [],
      warnings: [],
    };

    if (Array.isArray(adapted.changes)) {
      adaptedRecipe.changes = adapted.changes
        .filter(
          (c: any) =>
            typeof c.original === 'string' &&
            typeof c.replacement === 'string' &&
            typeof c.reason === 'string'
        )
        .map((c: any) => ({
          original: String(c.original).slice(0, 200),
          replacement: String(c.replacement).slice(0, 200),
          reason: String(c.reason).slice(0, 300),
        }))
        .slice(0, 20);
    }

    if (Array.isArray(adapted.warnings)) {
      adaptedRecipe.warnings = adapted.warnings
        .filter((w: any) => typeof w === 'string')
        .map((w: string) => w.slice(0, 300))
        .slice(0, 5);
    }

    return adaptedRecipe;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse adapted recipe from AI response.');
    }
    throw error;
  }
}
