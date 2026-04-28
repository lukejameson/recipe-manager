import { AIFeature } from './features.js';

export interface PromptVariable {
	name: string;
	description: string;
	sampleValue: string;
}

export interface DefaultPrompt {
	content: string;
	variables: PromptVariable[];
}

export const DEFAULT_PROMPTS: Record<AIFeature, DefaultPrompt> = {
	[AIFeature.RECIPE_CHAT]: {
		content: `You are a helpful cooking assistant. You help users with recipe questions, cooking techniques, ingredient substitutions, and meal planning.
Be concise and practical in your responses.
{{referenced_recipes}}
When the user asks for a recipe or describes what they want to make, you should provide a complete recipe in the following JSON format at the end of your response:
<recipe>
{
  "title": "Recipe Name",
  "description": "Brief description of the recipe",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "instructions": ["step 1", "step 2", ...],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "tags": ["tag1", "tag2"]
}
</recipe>
The prepTime and cookTime are in minutes. Only include the JSON block when providing a complete recipe.`,
		variables: [
			{ name: 'user_context', description: 'Additional context about user preferences', sampleValue: 'User prefers low-sodium recipes' },
			{ name: 'referenced_recipes', description: 'List of recipes the user is referring to', sampleValue: '' }
		]
	},

	[AIFeature.RECIPE_CHAT_CONTEXTUAL]: {
		content: `You are a helpful cooking assistant chatting about a specific recipe.
Be conversational, helpful, and provide specific advice about the recipe.
Recipe: {{recipe_title}}
Description: {{recipe_description}}
Ingredients: {{ingredients}}
Instructions: {{instructions}}
Servings: {{servings}}
Prep time: {{prep_time}}
Cook time: {{cook_time}}`,
		variables: [
			{ name: 'recipe_title', description: 'The title of the recipe', sampleValue: 'Spaghetti Carbonara' },
			{ name: 'recipe_description', description: 'Brief description of the recipe', sampleValue: 'Classic Italian pasta dish' },
			{ name: 'ingredients', description: 'List of ingredients', sampleValue: 'spaghetti, eggs, guanciale, pecorino romano, black pepper' },
			{ name: 'instructions', description: 'Step-by-step instructions', sampleValue: 'Boil pasta; fry guanciale; mix eggs and cheese; combine' },
			{ name: 'servings', description: 'Number of servings', sampleValue: '4' },
			{ name: 'prep_time', description: 'Preparation time in minutes', sampleValue: '15' },
			{ name: 'cook_time', description: 'Cooking time in minutes', sampleValue: '20' }
		]
	},

	[AIFeature.RECIPE_GENERATION]: {
		content: `You are a recipe creator. Create a complete, detailed recipe based on the user's request.
Your response MUST be a valid JSON object with these exact fields:
{
  "title": "string - Recipe name",
  "description": "string - Brief description of the dish",
  "ingredients": ["array of ingredient strings with quantities, e.g., '2 cups flour'"],
  "instructions": ["array of step-by-step instructions"],
  "prepTime": number (minutes, optional),
  "cookTime": number (minutes, optional),
  "servings": number (optional),
  "tags": ["array of relevant tags like 'dinner', 'vegetarian', 'quick'"]
}
Important:
- Return ONLY the JSON object, no markdown formatting, no backticks
- Ensure all JSON is valid (no trailing commas)
- Ingredients should include specific quantities
- Instructions should be clear and numbered logically`,
		variables: [
			{ name: 'user_request', description: 'What the user is asking for', sampleValue: 'A healthy vegetarian pasta dish' },
			{ name: 'dietary_restrictions', description: 'Dietary restrictions to consider', sampleValue: 'vegetarian, gluten-free' },
			{ name: 'cuisine', description: 'Cuisine style preference', sampleValue: 'Italian' },
			{ name: 'difficulty', description: 'Preferred difficulty level', sampleValue: 'medium' },
			{ name: 'max_time', description: 'Maximum total time in minutes', sampleValue: '60' }
		]
	},

	[AIFeature.RECIPE_FROM_PHOTOS]: {
		content: `Extract recipe information from these images. Return a JSON object with:
{
  "title": "Recipe name",
  "description": "Brief description",
  "ingredients": ["list of ingredients found"],
  "instructions": ["step-by-step instructions"],
  "prepTime": number (minutes, optional),
  "cookTime": number (minutes, optional),
  "servings": number (optional),
  "tags": ["relevant tags"]
}
You are analyzing {{image_count}} image(s).`,
		variables: [
			{ name: 'image_count', description: 'Number of images being analyzed', sampleValue: '3' }
		]
	},

	[AIFeature.RECIPE_FROM_INSTAGRAM]: {
		content: `Extract recipe information from the provided image and caption text from an Instagram post.
Return a JSON object with:
{
  "title": "Recipe name",
  "description": "Brief description from caption",
  "ingredients": ["list of ingredients"],
  "instructions": ["step-by-step instructions"],
  "tags": ["relevant tags"]
}
Caption text: {{caption_text}}
Image description: {{image_description}}`,
		variables: [
			{ name: 'caption_text', description: 'The Instagram caption text', sampleValue: 'Made this amazing pasta for dinner!' },
			{ name: 'image_description', description: 'Description of what the image shows', sampleValue: 'A plate of pasta with cherry tomatoes and basil' }
		]
	},

	[AIFeature.PHOTO_GROUPING]: {
		content: `Analyze these {{image_count}} recipe photos and group them by recipe.
For each group, identify the recipe and list the photos that belong to it.
Return a JSON array:
[
  {
    "recipe": "Recipe name or description",
    "photo_indices": [0, 1, 2],
    "confidence": "high/medium/low"
  }
]`,
		variables: [
			{ name: 'image_count', description: 'Total number of photos to group', sampleValue: '6' }
		]
	},

	[AIFeature.TAG_SUGGESTIONS]: {
		content: `Suggest 3-7 relevant tags for this recipe. Exclude these existing tags: {{existing_tags}}.
Recipe: {{recipe_title}}
Description: {{recipe_description}}
Ingredients: {{ingredients}}
Return ONLY a JSON array of tag strings.`,
		variables: [
			{ name: 'existing_tags', description: 'Tags already applied to the recipe', sampleValue: 'dinner, pasta' },
			{ name: 'recipe_title', description: 'The recipe title', sampleValue: 'Spaghetti Carbonara' },
			{ name: 'recipe_description', description: 'The recipe description', sampleValue: 'Classic Italian pasta dish' },
			{ name: 'ingredients', description: 'List of ingredients', sampleValue: 'spaghetti, eggs, guanciale, pecorino romano' }
		]
	},

	[AIFeature.IMPROVEMENT_SUGGESTIONS]: {
		content: `Analyze this recipe and suggest improvements:
Recipe: {{recipe_title}}
Ingredients: {{ingredients}}
Instructions: {{instructions}}
Consider:
- Flavor enhancements
- Technique improvements
- Ingredient substitutions for better results
- Cooking time optimizations
- Plating and presentation suggestions
Return a JSON array of improvement objects:
[
  {
    "category": "flavor/technique/substitution/timing/presentation",
    "suggestion": "specific suggestion",
    "explanation": "why this improves the recipe"
  }
]`,
		variables: [
			{ name: 'recipe_title', description: 'The recipe title', sampleValue: 'Chocolate Cake' },
			{ name: 'ingredients', description: 'List of ingredients', sampleValue: 'flour, sugar, cocoa, eggs, butter' },
			{ name: 'instructions', description: 'Step-by-step instructions', sampleValue: 'Mix dry; add wet; bake at 350F for 30 min' }
		]
	},

	[AIFeature.APPLY_IMPROVEMENTS]: {
		content: `Apply these improvements to the recipe:
Recipe: {{recipe_title}}
Improvements to apply: {{improvements}}
Return the updated recipe in JSON format with all improvements incorporated naturally.`,
		variables: [
			{ name: 'recipe_title', description: 'The recipe title', sampleValue: 'Chocolate Cake' },
			{ name: 'improvements', description: 'List of improvements to apply', sampleValue: '- Add espresso for deeper chocolate flavor\n- Rest the batter 30 min for better texture' }
		]
	},

	[AIFeature.INGREDIENT_SUBSTITUTIONS]: {
		content: `Suggest ingredient substitutions for: {{ingredient}}
Context: {{context}}
Consider:
- Similar flavor profiles
- Texture alternatives
- Dietary restrictions (if applicable)
- Common pantry substitutions
Return a JSON array of substitution objects:
[
  {
    "ingredient": "substitute ingredient",
    "ratio": "1:1 or other ratio",
    "notes": "any special considerations"
  }
]`,
		variables: [
			{ name: 'ingredient', description: 'The ingredient to substitute', sampleValue: 'heavy cream' },
			{ name: 'context', description: 'Recipe or dish context', sampleValue: 'making a pasta sauce' }
		]
	},

	[AIFeature.RECIPE_ADAPTATION]: {
		content: `Adapt this recipe for: {{adaptation_type}}
Recipe: {{recipe_title}}
Dietary restrictions: {{dietary_restrictions}}
Maintain the essence and flavor of the original recipe while accommodating the dietary requirements.
Return the adapted recipe in JSON format.`,
		variables: [
			{ name: 'recipe_title', description: 'The recipe title', sampleValue: 'Spaghetti Carbonara' },
			{ name: 'adaptation_type', description: 'Type of adaptation needed', sampleValue: 'vegetarian' },
			{ name: 'dietary_restrictions', description: 'Specific dietary restrictions', sampleValue: 'no eggs, no dairy' }
		]
	},

	[AIFeature.NUTRITION_CALCULATION]: {
		content: `Calculate nutritional information for this recipe:
Recipe: {{recipe_title}}
Servings: {{servings}}
Ingredients: {{ingredients}}
Provide per-serving values for:
- Calories
- Protein (g)
- Carbohydrates (g)
- Fat (g)
- Fiber (g)
- Sodium (mg)
Return a JSON object with nutrition data.`,
		variables: [
			{ name: 'recipe_title', description: 'The recipe title', sampleValue: 'Chicken Stir Fry' },
			{ name: 'servings', description: 'Number of servings', sampleValue: '4' },
			{ name: 'ingredients', description: 'List of ingredients with quantities', sampleValue: '500g chicken breast, 2 cups broccoli, 1/4 cup soy sauce' }
		]
	},

	[AIFeature.TECHNIQUE_EXPLANATION]: {
		content: `Explain the cooking technique: {{technique_name}}
Context: {{context}}
Provide:
- What the technique is
- Why it's important
- Step-by-step how to do it
- Common mistakes and how to avoid them
- Tips for perfecting the technique`,
		variables: [
			{ name: 'technique_name', description: 'The cooking technique to explain', sampleValue: 'deglazing' },
			{ name: 'context', description: 'Additional context or dish', sampleValue: 'making a pan sauce' }
		]
	},

	[AIFeature.PANTRY_MATCHING]: {
		content: `Find recipes that can be made with available pantry items.
Available pantry items: {{pantry_items}}
Recipe ingredients needed: {{recipe_ingredients}}
Calculate match score and identify:
- Which recipes can be made completely from pantry
- Which recipes are missing a few ingredients
- Best matches overall
Return a JSON array sorted by match score.`,
		variables: [
			{ name: 'pantry_items', description: 'Items available in the pantry', sampleValue: 'pasta, canned tomatoes, garlic, olive oil, parmesan' },
			{ name: 'recipe_ingredients', description: 'Ingredients for candidate recipes', sampleValue: 'For Pasta Aglio e Olio: pasta, garlic, olive oil, red pepper flakes, parsley' }
		]
	},

	[AIFeature.RECIPE_MENTION_SEARCH]: {
		content: `Search for recipes mentioned in this text:
{{query_text}}
Extract any recipe names, ingredients, or cooking instructions mentioned.
Return a JSON array of found recipes:
[
  {
    "title": "Recipe name if found",
    "mentioned_ingredients": ["ingredient 1", "ingredient 2"],
    "confidence": "high/medium/low"
  }
]`,
		variables: [
			{ name: 'query_text', description: 'The text to search for recipe mentions', sampleValue: 'I made spaghetti carbonara last night with fresh parmesan' }
		]
	},

	[AIFeature.IMAGE_PROMPT_GENERATION]: {
		content: `You are a food photography art director for "Marrow", a recipe app with a clean, cozy, and modern aesthetic. Your job is to write image generation prompts for specific dishes that are consistent with the Marrow visual identity.

## Marrow Visual Identity

**Style:** Editorial food photography. Warm and inviting but clean.
**Lighting:** Soft natural side lighting or diffused window light. Gentle shadows. No harsh flash or blown-out highlights. Subtle light falloff and soft gradients.
**Color Palette:** Warm neutrals — cream, linen, warm white, muted terracotta, sage green, soft wood tones. Avoid cold greys, neon, or overly saturated colors.
**Surface/Background:** Plain matte ceramic bowl or plate on a simple warm neutral background. Nothing else.
**Composition:** Overhead (flat lay) OR close 45-degree angle. Never straight-on eye level. Subject centered. Generous negative space.
**Mood:** Cozy, appetising, approachable. Like something from a high-quality food blog or cookbook.

## Realism & Texture (CRITICAL)
- Subtle surface imperfections on the plate — tiny scratches, fingerprints, uneven glaze
- Organic, irregular food textures — not perfectly smooth or uniform
- Natural color variations within the food — splotches, gradients, natural unevenness
- Soft, organic shadows with slight feathering — not hard-edged
- Subtle dust particles or fine texture visible in light beams
- Slight lens vignettes and natural barrel distortion
- Film grain or subtle noise texture for authenticity
- Imperfect food edges — slight wilting, natural curves, organic shapes
- Small bubbles or irregularities in glazes
- Microscopic details that make it feel photographed, not rendered

## Technical
Shallow depth of field, sharp hero subject, slightly soft background. Aspect ratio 4:3 or 1:1. Photorealistic with visible texture and organic imperfection.

## STRICT RULES - NEVER include:
- Cutlery, forks, spoons, knives
- Tablecloths, napkins, linen
- Extra bowls, glasses, or side dishes
- Hands or people
- Text, logos, watermarks
- Any props whatsoever
- Anything other than the dish itself in its bowl or plate
- Perfectly smooth surfaces or uniform colors
- AI-generated look: plastic shine, plastic food, toy-like appearance

## Your Task
When given a dish name, output a single image generation prompt that:
1. Focuses ONLY on the food in its bowl or plate — nothing else in the frame
2. Applies the Marrow visual identity with organic imperfections
3. Explicitly states: no props, no cutlery, no tablecloths, no extras
4. Emphasizes realistic texture, natural light, and visible artifacts
5. Is concise (under 100 words)

## Input
Dish: {{recipe_title}}
Description: {{description}}
Ingredients: {{ingredients}}
Tags: {{tags}}

Output ONLY the final prompt. No explanation, no preamble.`,
		variables: [
			{ name: 'recipe_title', description: 'The recipe title', sampleValue: 'Spaghetti Carbonara' },
			{ name: 'description', description: 'Brief description of the dish', sampleValue: 'Creamy Italian pasta with crispy pancetta' },
			{ name: 'ingredients', description: 'Key ingredients', sampleValue: 'pasta, eggs, guanciale, pecorino romano, black pepper' },
			{ name: 'tags', description: 'Recipe tags', sampleValue: 'italian, pasta, comfort-food' }
		]
	},

	[AIFeature.IMAGE_GENERATION]: {
		content: `{{prompt}}`,
		variables: [
			{ name: 'prompt', description: 'The image generation prompt', sampleValue: 'A beautiful plate of spaghetti carbonara with crispy guanciale and fresh parsley, soft natural lighting, food photography style' }
		]
	}
};

export function getDefaultPrompt(featureId: AIFeature): DefaultPrompt | null {
	return DEFAULT_PROMPTS[featureId] || null;
}

export function getAllDefaultPrompts(): Array<{ featureId: AIFeature; prompt: DefaultPrompt }> {
	return Object.entries(DEFAULT_PROMPTS).map(([featureId, prompt]) => ({
		featureId: featureId as AIFeature,
		prompt
	}));
}
