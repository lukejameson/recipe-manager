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
