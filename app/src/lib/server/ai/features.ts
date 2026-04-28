export enum AIFeature {
	RECIPE_CHAT = 'recipe_chat',
	RECIPE_CHAT_CONTEXTUAL = 'recipe_chat_contextual',
	RECIPE_GENERATION = 'recipe_generation',
	RECIPE_FROM_PHOTOS = 'recipe_from_photos',
	RECIPE_FROM_INSTAGRAM = 'recipe_from_instagram',
	PHOTO_GROUPING = 'photo_grouping',
	TAG_SUGGESTIONS = 'tag_suggestions',
	IMPROVEMENT_SUGGESTIONS = 'improvement_suggestions',
	APPLY_IMPROVEMENTS = 'apply_improvements',
	INGREDIENT_SUBSTITUTIONS = 'ingredient_substitutions',
	RECIPE_ADAPTATION = 'recipe_adaptation',
	NUTRITION_CALCULATION = 'nutrition_calculation',
	TECHNIQUE_EXPLANATION = 'technique_explanation',
	PANTRY_MATCHING = 'pantry_matching',
	RECIPE_MENTION_SEARCH = 'recipe_mention_search',
	IMAGE_PROMPT_GENERATION = 'image_prompt_generation',
	IMAGE_GENERATION = 'image_generation'
}
export interface FeatureConfig {
	feature: AIFeature;
	providerId: string;
	modelId: string;
	temperature?: number;
	maxTokens?: number;
	enabled: boolean;
}
export const DEFAULT_FEATURE_CONFIGS: Record<AIFeature, { temperature: number; maxTokens: number; requiresVision: boolean }> = {
	[AIFeature.RECIPE_CHAT]: {
		temperature: 0.7,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.RECIPE_CHAT_CONTEXTUAL]: {
		temperature: 0.7,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.RECIPE_GENERATION]: {
		temperature: 0.7,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.RECIPE_FROM_PHOTOS]: {
		temperature: 0.3,
		maxTokens: 4096,
		requiresVision: true
	},
	[AIFeature.RECIPE_FROM_INSTAGRAM]: {
		temperature: 0.3,
		maxTokens: 4096,
		requiresVision: true
	},
	[AIFeature.PHOTO_GROUPING]: {
		temperature: 0.3,
		maxTokens: 2048,
		requiresVision: true
	},
	[AIFeature.TAG_SUGGESTIONS]: {
		temperature: 0.3,
		maxTokens: 1024,
		requiresVision: false
	},
	[AIFeature.IMPROVEMENT_SUGGESTIONS]: {
		temperature: 0.5,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.APPLY_IMPROVEMENTS]: {
		temperature: 0.3,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.INGREDIENT_SUBSTITUTIONS]: {
		temperature: 0.4,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.RECIPE_ADAPTATION]: {
		temperature: 0.5,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.NUTRITION_CALCULATION]: {
		temperature: 0.2,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.TECHNIQUE_EXPLANATION]: {
		temperature: 0.5,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.PANTRY_MATCHING]: {
		temperature: 0.3,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.RECIPE_MENTION_SEARCH]: {
		temperature: 0.2,
		maxTokens: 1024,
		requiresVision: false
	},
	[AIFeature.IMAGE_PROMPT_GENERATION]: {
		temperature: 0.3,
		maxTokens: 1024,
		requiresVision: false
	},
	[AIFeature.IMAGE_GENERATION]: {
		temperature: 0.5,
		maxTokens: 2048,
		requiresVision: false
	}
};
export const FEATURE_NAMES: Record<AIFeature, string> = {
	[AIFeature.RECIPE_CHAT]: 'Recipe Chat',
	[AIFeature.RECIPE_CHAT_CONTEXTUAL]: 'Recipe Chat (Contextual)',
	[AIFeature.RECIPE_GENERATION]: 'Recipe Generation',
	[AIFeature.RECIPE_FROM_PHOTOS]: 'Recipe from Photos',
	[AIFeature.RECIPE_FROM_INSTAGRAM]: 'Recipe from Instagram',
	[AIFeature.PHOTO_GROUPING]: 'Photo Grouping',
	[AIFeature.TAG_SUGGESTIONS]: 'Tag Suggestions',
	[AIFeature.IMPROVEMENT_SUGGESTIONS]: 'Improvement Suggestions',
	[AIFeature.APPLY_IMPROVEMENTS]: 'Apply Improvements',
	[AIFeature.INGREDIENT_SUBSTITUTIONS]: 'Ingredient Substitutions',
	[AIFeature.RECIPE_ADAPTATION]: 'Recipe Adaptation',
	[AIFeature.NUTRITION_CALCULATION]: 'Nutrition Calculation',
	[AIFeature.TECHNIQUE_EXPLANATION]: 'Technique Explanation',
	[AIFeature.PANTRY_MATCHING]: 'Pantry Matching',
	[AIFeature.RECIPE_MENTION_SEARCH]: 'Recipe Mention Search',
	[AIFeature.IMAGE_PROMPT_GENERATION]: 'Image Prompt Generation',
	[AIFeature.IMAGE_GENERATION]: 'Image Generation'
};
export const FEATURE_DESCRIPTIONS: Record<AIFeature, string> = {
	[AIFeature.RECIPE_CHAT]: 'General chat about recipes and cooking',
	[AIFeature.RECIPE_CHAT_CONTEXTUAL]: 'Chat about a specific recipe with full context',
	[AIFeature.RECIPE_GENERATION]: 'Generate new recipes from text descriptions',
	[AIFeature.RECIPE_FROM_PHOTOS]: 'Extract recipes from uploaded photos (requires vision)',
	[AIFeature.RECIPE_FROM_INSTAGRAM]: 'Extract recipes from Instagram posts via oEmbed (requires vision)',
	[AIFeature.PHOTO_GROUPING]: 'Group photos by recipe (requires vision)',
	[AIFeature.TAG_SUGGESTIONS]: 'Suggest tags for recipes',
	[AIFeature.IMPROVEMENT_SUGGESTIONS]: 'Suggest improvements to recipes',
	[AIFeature.APPLY_IMPROVEMENTS]: 'Apply suggested improvements to recipes',
	[AIFeature.INGREDIENT_SUBSTITUTIONS]: 'Suggest ingredient substitutions',
	[AIFeature.RECIPE_ADAPTATION]: 'Adapt recipes for dietary restrictions or serving sizes',
	[AIFeature.NUTRITION_CALCULATION]: 'Calculate nutritional information',
	[AIFeature.TECHNIQUE_EXPLANATION]: 'Explain cooking techniques',
	[AIFeature.PANTRY_MATCHING]: 'Find recipes matching available pantry items',
	[AIFeature.RECIPE_MENTION_SEARCH]: 'Search for recipes mentioned in text',
	[AIFeature.IMAGE_PROMPT_GENERATION]: 'Generate image prompts from recipe details',
	[AIFeature.IMAGE_GENERATION]: 'Generate images from text prompts'
};
export enum FeatureCategory {
	CHAT = 'chat',
	GENERATION = 'generation',
	ENHANCEMENT = 'enhancement',
	ANALYSIS = 'analysis'
}
export const FEATURE_CATEGORIES: Record<AIFeature, FeatureCategory> = {
	[AIFeature.RECIPE_CHAT]: FeatureCategory.CHAT,
	[AIFeature.RECIPE_CHAT_CONTEXTUAL]: FeatureCategory.CHAT,
	[AIFeature.RECIPE_GENERATION]: FeatureCategory.GENERATION,
	[AIFeature.RECIPE_FROM_PHOTOS]: FeatureCategory.GENERATION,
	[AIFeature.RECIPE_FROM_INSTAGRAM]: FeatureCategory.GENERATION,
	[AIFeature.PHOTO_GROUPING]: FeatureCategory.GENERATION,
	[AIFeature.TAG_SUGGESTIONS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.IMPROVEMENT_SUGGESTIONS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.APPLY_IMPROVEMENTS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.INGREDIENT_SUBSTITUTIONS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.RECIPE_ADAPTATION]: FeatureCategory.ENHANCEMENT,
	[AIFeature.NUTRITION_CALCULATION]: FeatureCategory.ANALYSIS,
	[AIFeature.TECHNIQUE_EXPLANATION]: FeatureCategory.ANALYSIS,
	[AIFeature.PANTRY_MATCHING]: FeatureCategory.ANALYSIS,
	[AIFeature.RECIPE_MENTION_SEARCH]: FeatureCategory.ANALYSIS,
	[AIFeature.IMAGE_PROMPT_GENERATION]: FeatureCategory.GENERATION,
	[AIFeature.IMAGE_GENERATION]: FeatureCategory.GENERATION
};
export const CATEGORY_NAMES: Record<FeatureCategory, string> = {
	[FeatureCategory.CHAT]: 'Chat',
	[FeatureCategory.GENERATION]: 'Generation',
	[FeatureCategory.ENHANCEMENT]: 'Enhancement',
	[FeatureCategory.ANALYSIS]: 'Analysis'
};
