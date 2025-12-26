import { aiService } from './index.js';

export interface ImprovementInput {
  recipe: {
    title: string;
    description?: string;
    ingredients: string[];
    instructions: string[];
    prepTime?: number;
    cookTime?: number;
  };
  focusAreas?: ('flavor' | 'technique' | 'presentation' | 'efficiency')[];
}

export interface ImprovementSuggestion {
  category: string;
  suggestion: string;
  explanation: string;
  priority: 'high' | 'medium' | 'low';
}

const IMPROVEMENT_SYSTEM_PROMPT = `You are a professional chef and culinary consultant helping improve home recipes.

Analyze the recipe and suggest practical improvements.

Return ONLY a valid JSON array of suggestions:
[
  {
    "category": "flavor|technique|presentation|efficiency",
    "suggestion": "specific actionable suggestion",
    "explanation": "why this improves the recipe",
    "priority": "high|medium|low"
  }
]

Categories:
- flavor: Seasoning, aromatics, umami, balance
- technique: Cooking methods, timing, temperature
- presentation: Plating, garnishes, visual appeal
- efficiency: Time-saving, prep tips, equipment

Guidelines:
- Suggest 3-6 improvements
- Be specific and actionable
- Consider the home cook's skill level
- Prioritize impactful changes as "high"
- Don't suggest changing the fundamental nature of the dish
- When mentioning quantities, use metric units (grams, ml, liters)
- When mentioning temperatures, use Celsius
- Return ONLY the JSON array, no other text`;

export async function suggestImprovements(
  input: ImprovementInput
): Promise<ImprovementSuggestion[]> {
  const { recipe, focusAreas } = input;

  let userPrompt = `Suggest improvements for this recipe:

Title: ${recipe.title}
${recipe.description ? `Description: ${recipe.description}` : ''}
${recipe.prepTime ? `Prep Time: ${recipe.prepTime} minutes` : ''}
${recipe.cookTime ? `Cook Time: ${recipe.cookTime} minutes` : ''}

Ingredients:
${recipe.ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Instructions:
${recipe.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}`;

  if (focusAreas?.length) {
    userPrompt += `\n\nFocus on these areas: ${focusAreas.join(', ')}`;
  }

  userPrompt += '\n\nReturn improvement suggestions as JSON.';

  const result = await aiService.complete({
    systemPrompt: IMPROVEMENT_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1024,
    temperature: 0.5,
    useHaiku: true, // Suggestion generation task
  });

  try {
    let jsonStr = result.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const suggestions = JSON.parse(jsonStr);

    if (!Array.isArray(suggestions)) {
      throw new Error('Expected array of suggestions');
    }

    const validCategories = ['flavor', 'technique', 'presentation', 'efficiency'];
    const validPriorities = ['high', 'medium', 'low'];

    return suggestions
      .filter(
        (s: any) =>
          typeof s.category === 'string' &&
          typeof s.suggestion === 'string' &&
          typeof s.explanation === 'string' &&
          typeof s.priority === 'string'
      )
      .map((s: any) => ({
        category: validCategories.includes(s.category) ? s.category : 'flavor',
        suggestion: String(s.suggestion).slice(0, 300),
        explanation: String(s.explanation).slice(0, 500),
        priority: validPriorities.includes(s.priority) ? s.priority : 'medium',
      }))
      .slice(0, 10);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse improvement suggestions from AI response.');
    }
    throw error;
  }
}

export interface ApplyImprovementsInput {
  recipe: {
    title: string;
    ingredients: string[];
    instructions: string[];
  };
  improvements: string[];
}

export interface AppliedRecipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  changes: string[];
}

const APPLY_IMPROVEMENTS_PROMPT = `You are a professional chef helping to modify a recipe based on specific improvements.

Your task is to take the recipe and apply the requested improvements, modifying the ingredients and instructions as needed.

Return ONLY valid JSON in this format:
{
  "title": "Recipe title (unchanged unless improvement specifically affects it)",
  "ingredients": ["list of ingredients with modifications applied"],
  "instructions": ["list of instructions with modifications applied"],
  "changes": ["brief description of each change made"]
}

Guidelines:
- Apply ONLY the requested improvements
- Keep the recipe's essential character intact
- Be specific in the changes array about what was modified
- Use metric units (grams, ml, liters) for all ingredient quantities
- Use Celsius for any temperatures in instructions
- Maintain similar formatting for ingredients and instructions
- If an improvement doesn't require a change to ingredients/instructions, note it in changes but leave the sections unchanged
- Return ONLY the JSON object, no other text`;

export async function applyImprovements(
  input: ApplyImprovementsInput
): Promise<AppliedRecipe> {
  const { recipe, improvements } = input;

  const userPrompt = `Apply these improvements to the recipe:

RECIPE:
Title: ${recipe.title}

Ingredients:
${recipe.ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Instructions:
${recipe.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

IMPROVEMENTS TO APPLY:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}

Return the modified recipe as JSON.`;

  const result = await aiService.complete({
    systemPrompt: APPLY_IMPROVEMENTS_PROMPT,
    userPrompt,
    maxTokens: 2048,
    temperature: 0.3,
  });

  try {
    let jsonStr = result.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const applied = JSON.parse(jsonStr);

    if (
      typeof applied.title !== 'string' ||
      !Array.isArray(applied.ingredients) ||
      !Array.isArray(applied.instructions)
    ) {
      throw new Error('Invalid response format');
    }

    return {
      title: String(applied.title).slice(0, 200),
      ingredients: applied.ingredients.map((i: any) => String(i).slice(0, 500)),
      instructions: applied.instructions.map((i: any) => String(i).slice(0, 1000)),
      changes: Array.isArray(applied.changes)
        ? applied.changes.map((c: any) => String(c).slice(0, 200))
        : [],
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse applied recipe from AI response.');
    }
    throw error;
  }
}
