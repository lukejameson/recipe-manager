import { aiService } from './index.js';

export interface PantryMatchInput {
  availableIngredients: string[];
  recipes: Array<{
    id: string;
    title: string;
    ingredients: string[];
  }>;
}

export interface MatchedRecipe {
  recipeId: string;
  matchScore: number;
  matchedIngredients: string[];
  missingIngredients: string[];
}

const PANTRY_MATCH_SYSTEM_PROMPT = `You are a culinary assistant helping match available ingredients to recipes.

Given a list of available ingredients and recipes, score how well each recipe matches.

Consider:
- Exact matches (chicken = chicken)
- Partial matches (chicken breast matches chicken)
- Common pantry staples (salt, pepper, oil, water) shouldn't count as missing
- Core vs optional ingredients (missing a garnish is less important than missing the main protein)

Return ONLY a valid JSON array:
[
  {
    "recipeId": "the recipe ID",
    "matchScore": 0-100,
    "matchedIngredients": ["ingredients from the recipe you have"],
    "missingIngredients": ["ingredients you need but don't have"]
  }
]

Guidelines:
- Score 80-100: Can make with what you have
- Score 60-79: Missing 1-2 items
- Score 40-59: Missing several items but could improvise
- Score 0-39: Missing too many key ingredients
- Ignore common staples when calculating missing items
- Return recipes sorted by matchScore descending
- Return ONLY the JSON array, no other text`;

export async function findMatchingRecipes(input: PantryMatchInput): Promise<MatchedRecipe[]> {
  const { availableIngredients, recipes } = input;

  if (recipes.length === 0) {
    return [];
  }

  const userPrompt = `Available ingredients:
${availableIngredients.map((ing) => `- ${ing}`).join('\n')}

Recipes to match:
${recipes
  .map(
    (r) => `
ID: ${r.id}
Title: ${r.title}
Ingredients: ${r.ingredients.join(', ')}`
  )
  .join('\n---')}

Score how well each recipe matches the available ingredients. Return as JSON.`;

  const result = await aiService.complete({
    systemPrompt: PANTRY_MATCH_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 2048,
    temperature: 0.2,
  });

  try {
    let jsonStr = result.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const matches = JSON.parse(jsonStr);

    if (!Array.isArray(matches)) {
      throw new Error('Expected array of matches');
    }

    return matches
      .filter(
        (m: any) =>
          typeof m.recipeId === 'string' &&
          typeof m.matchScore === 'number' &&
          Array.isArray(m.matchedIngredients) &&
          Array.isArray(m.missingIngredients)
      )
      .map((m: any) => ({
        recipeId: String(m.recipeId),
        matchScore: Math.max(0, Math.min(100, Math.round(m.matchScore))),
        matchedIngredients: m.matchedIngredients
          .filter((i: any) => typeof i === 'string')
          .slice(0, 30),
        missingIngredients: m.missingIngredients
          .filter((i: any) => typeof i === 'string')
          .slice(0, 15),
      }))
      .sort((a: MatchedRecipe, b: MatchedRecipe) => b.matchScore - a.matchScore);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse recipe matches from AI response.');
    }
    throw error;
  }
}
