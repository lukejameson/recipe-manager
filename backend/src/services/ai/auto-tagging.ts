import { aiService } from './index.js';

export interface AutoTagInput {
  recipe: {
    title: string;
    description?: string;
    ingredients: string[];
    instructions: string[];
  };
  existingTags?: string[];
}

export interface TagSuggestion {
  tag: string;
  confidence: number;
  reason: string;
}

const AUTO_TAG_SYSTEM_PROMPT = `You are a culinary expert helping to categorize recipes. Given recipe details, suggest appropriate tags.

Consider these tag categories:
- Recipe type (cocktail, mocktail, drink, beverage for drinks; food for regular recipes)
- Cuisine type (Italian, Mexican, Asian, Mediterranean, etc.)
- Meal type (breakfast, lunch, dinner, snack, dessert)
- Dietary (vegetarian, vegan, gluten-free, dairy-free, keto, low-carb)
- Cooking method (grilled, baked, fried, slow-cooker, instant-pot, no-cook)
- Difficulty (quick, easy, intermediate, advanced)
- Season/occasion (summer, winter, holiday, party, weeknight)
- Main ingredient (chicken, beef, seafood, pasta, vegetables)
- For cocktails/drinks: spirit base (vodka, gin, rum, whiskey, tequila), style (classic, tiki, sour, fizz)

Return ONLY a valid JSON array of tag suggestions:
[
  {
    "tag": "lowercase-hyphenated-tag",
    "confidence": 0.0-1.0,
    "reason": "brief explanation"
  }
]

Guidelines:
- Suggest 3-8 relevant tags
- Use lowercase with hyphens for multi-word tags
- Confidence should reflect how certain you are (0.9+ for obvious, 0.5-0.7 for reasonable guesses)
- If existingTags are provided, prefer matching those for consistency
- Return ONLY the JSON array, no other text`;

export async function suggestTags(input: AutoTagInput): Promise<TagSuggestion[]> {
  const { recipe, existingTags } = input;

  const userPrompt = `Suggest tags for this recipe:

Title: ${recipe.title}
${recipe.description ? `Description: ${recipe.description}` : ''}

Ingredients:
${recipe.ingredients.slice(0, 15).map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Instructions:
${recipe.instructions.slice(0, 5).map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

${existingTags?.length ? `\nExisting tags in system (prefer these for consistency): ${existingTags.join(', ')}` : ''}

Return tag suggestions as JSON.`;

  const result = await aiService.complete({
    systemPrompt: AUTO_TAG_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 512,
    temperature: 0.2,
    useHaiku: true, // Simple categorization task
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

    return suggestions
      .filter(
        (s: any) =>
          typeof s.tag === 'string' &&
          typeof s.confidence === 'number' &&
          typeof s.reason === 'string'
      )
      .map((s: any) => ({
        tag: s.tag.toLowerCase().replace(/\s+/g, '-').slice(0, 50),
        confidence: Math.max(0, Math.min(1, s.confidence)),
        reason: String(s.reason).slice(0, 200),
      }))
      .slice(0, 10);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse tag suggestions from AI response.');
    }
    throw error;
  }
}
