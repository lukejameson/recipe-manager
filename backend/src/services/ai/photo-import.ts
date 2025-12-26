import { db } from '../../db/index.js';
import { settings } from '../../db/schema.js';
import { decrypt } from '../../utils/encryption.js';
import { eq } from 'drizzle-orm';

export interface PhotoRecipeInput {
  /** Base64 encoded images (can be multiple pages of the same recipe) */
  images: string[];
  /** Optional hint about what this recipe might be */
  hint?: string;
}

export interface ExtractedRecipe {
  title: string;
  description: string;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  servings?: number;
  ingredients: string[];
  instructions: string[];
  tags: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Confidence score 0-1 indicating how well the recipe was extracted */
  confidence: number;
  /** Notes about the extraction (e.g., unclear text, guessed values) */
  extractionNotes?: string;
}

export interface BulkPhotoInput {
  /** 
   * Array of image groups. Each group is a set of images that belong to the same recipe.
   * If images aren't pre-grouped, use analyzeAndGroupPhotos first.
   */
  imageGroups: string[][];
}

export interface PhotoAnalysisResult {
  /** Grouped images - each inner array is one recipe */
  groups: string[][];
  /** Analysis notes */
  notes: string;
}

const RECIPE_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting recipe information from photos of cookbook pages, handwritten recipes, and printed recipe cards.

Your task is to carefully analyze the provided image(s) and extract the complete recipe information.

IMPORTANT GUIDELINES:
1. If multiple images are provided, they are pages of the SAME recipe - combine information from all pages
2. Extract ALL ingredients with their exact quantities and units
3. Extract ALL instructions in order, numbered if possible
4. Convert any unclear handwriting by making your best educated guess
5. If something is partially obscured or unclear, note it in extractionNotes
6. Suggest appropriate tags based on the recipe type, cuisine, main ingredients, etc.
7. Estimate difficulty based on technique complexity and number of steps
8. If prep/cook times aren't listed, estimate them based on the recipe complexity

Return ONLY a valid JSON object with this structure:
{
  "title": "Recipe Name",
  "description": "Brief description of the dish",
  "prepTime": number or null (in minutes),
  "cookTime": number or null (in minutes),
  "totalTime": number or null (in minutes),
  "servings": number or null,
  "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity", ...],
  "instructions": ["Step 1 text", "Step 2 text", ...],
  "tags": ["tag1", "tag2", ...],
  "difficulty": "easy" | "medium" | "hard" | null,
  "confidence": number between 0 and 1,
  "extractionNotes": "any notes about unclear parts, guesses made, etc." or null
}

For ingredients:
- Include the full quantity, unit, and item (e.g., "2 cups all-purpose flour")
- Include any preparation notes (e.g., "1 onion, finely diced")

For instructions:
- Each step should be a complete sentence
- Preserve any important temperature or timing information
- If instructions span multiple pages, combine them in order

For confidence score:
- 1.0 = Perfectly clear, all text readable
- 0.8 = Mostly clear, minor guesses
- 0.5 = Partially readable, significant interpretation needed
- Below 0.5 = Largely unclear, many assumptions made`;

const PHOTO_ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing photos of recipes to determine which photos belong together as part of the same recipe.

Given multiple images, analyze them and group them by recipe. Consider:
1. Visual continuity (same page style, font, paper)
2. Recipe flow (ingredients followed by instructions)
3. Page numbers if visible
4. Headers/titles that indicate different recipes

Return ONLY a valid JSON object with this structure:
{
  "groups": [
    {"indices": [0, 1], "title": "Chocolate Cake", "reason": "Pages 1-2 of the same recipe, continuous instructions"},
    {"indices": [2], "title": "Vanilla Frosting", "reason": "Separate recipe card"}
  ],
  "notes": "Any overall notes about the analysis"
}

Where "indices" are the 0-based indices of the images that belong together.`;

// Default models for different tasks
const DEFAULT_MODELS = {
  extraction: 'claude-sonnet-4-20250514',
  grouping: 'claude-3-haiku-20240307',
};

/**
 * AI service specifically for photo-based recipe imports with vision capabilities.
 */
class PhotoImportService {
  private apiKey: string | null = null;
  private extractionModel: string = DEFAULT_MODELS.extraction;
  private groupingModel: string = DEFAULT_MODELS.grouping;

  /**
   * Load API key and models from database settings.
   */
  async initialize(): Promise<boolean> {
    try {
      const [appSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.id, 'app-settings'))
        .limit(1);

      if (!appSettings?.anthropicApiKey) {
        this.apiKey = null;
        return false;
      }

      this.apiKey = decrypt(appSettings.anthropicApiKey);
      // Use the configured primary model for extraction
      this.extractionModel = appSettings.anthropicModel || DEFAULT_MODELS.extraction;
      // Use the configured secondary model for grouping (simpler task)
      this.groupingModel = appSettings.anthropicSecondaryModel || DEFAULT_MODELS.grouping;
      return true;
    } catch (error) {
      console.error('Failed to initialize photo import service:', error);
      this.apiKey = null;
      return false;
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Make a vision API call with images
   */
  private async completeWithVision(
    systemPrompt: string,
    userPrompt: string,
    images: string[],
    options: {
      maxTokens?: number;
      model?: string;
    } = {}
  ): Promise<string> {
    const { maxTokens = 4096, model = this.extractionModel } = options;

    if (!this.apiKey) {
      throw new Error('Photo import service not initialized. Please configure your API key in Settings.');
    }

    // Build content array with images and text
    const content: Array<
      { type: 'image'; source: { type: 'base64'; media_type: string; data: string } } |
      { type: 'text'; text: string }
    > = [];

    // Add images first
    for (const image of images) {
      // Detect media type from base64 header or default to jpeg
      let mediaType = 'image/jpeg';
      let base64Data = image;

      if (image.startsWith('data:')) {
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mediaType = match[1];
          base64Data = match[2];
        }
      }

      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      });
    }

    // Add text prompt
    content.push({
      type: 'text',
      text: userPrompt,
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`Anthropic API error: ${errorMessage}`);
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    return data.content[0].text;
  }

  /**
   * Extract recipe data from one or more photos of the same recipe.
   * Multiple images are treated as multiple pages of a single recipe.
   */
  async extractRecipeFromPhotos(input: PhotoRecipeInput): Promise<ExtractedRecipe> {
    const { images, hint } = input;

    if (images.length === 0) {
      throw new Error('At least one image is required');
    }

    let userPrompt = `Please extract the recipe from ${images.length === 1 ? 'this image' : 'these images'}.`;
    
    if (images.length > 1) {
      userPrompt += ` These ${images.length} images are pages of the SAME recipe - please combine all information.`;
    }

    if (hint) {
      userPrompt += ` Hint: ${hint}`;
    }

    userPrompt += '\n\nReturn the extracted recipe as JSON.';

    const result = await this.completeWithVision(
      RECIPE_EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      images,
      { maxTokens: 4096, model: this.extractionModel }
    );

    // Parse the JSON response
    try {
      let jsonStr = result.trim();

      // Handle potential markdown code blocks
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate and sanitize the response
      const recipe: ExtractedRecipe = {
        title: String(parsed.title || 'Untitled Recipe'),
        description: String(parsed.description || ''),
        prepTime: typeof parsed.prepTime === 'number' ? parsed.prepTime : undefined,
        cookTime: typeof parsed.cookTime === 'number' ? parsed.cookTime : undefined,
        totalTime: typeof parsed.totalTime === 'number' ? parsed.totalTime : undefined,
        servings: typeof parsed.servings === 'number' ? parsed.servings : undefined,
        ingredients: Array.isArray(parsed.ingredients) 
          ? parsed.ingredients.map((i: unknown) => String(i)) 
          : [],
        instructions: Array.isArray(parsed.instructions) 
          ? parsed.instructions.map((i: unknown) => String(i)) 
          : [],
        tags: Array.isArray(parsed.tags) 
          ? parsed.tags.map((t: unknown) => String(t)) 
          : [],
        difficulty: ['easy', 'medium', 'hard'].includes(parsed.difficulty) 
          ? parsed.difficulty 
          : undefined,
        confidence: typeof parsed.confidence === 'number' 
          ? Math.max(0, Math.min(1, parsed.confidence)) 
          : 0.5,
        extractionNotes: parsed.extractionNotes ? String(parsed.extractionNotes) : undefined,
      };

      // Validate minimum requirements
      if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
        throw new Error('Could not extract any recipe content from the image(s)');
      }

      return recipe;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          'Failed to parse recipe data from AI response. The image may be unclear or not contain a recipe.'
        );
      }
      throw error;
    }
  }

  /**
   * Analyze multiple photos and group them by recipe.
   * Use this when you have many photos that might contain multiple different recipes.
   */
  async analyzeAndGroupPhotos(images: string[]): Promise<PhotoAnalysisResult> {
    if (images.length === 0) {
      return { groups: [], notes: 'No images provided' };
    }

    if (images.length === 1) {
      return { groups: [images], notes: 'Single image, no grouping needed' };
    }

    const userPrompt = `I have ${images.length} photos that may contain one or more recipes.
Please analyze them and tell me which images belong together as parts of the same recipe.
Images are numbered 0 through ${images.length - 1} in the order provided.`;

    // Use Haiku for grouping - it's a simpler classification task
    // and costs significantly less than Sonnet
    const result = await this.completeWithVision(
      PHOTO_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      images,
      { maxTokens: 2048, model: this.groupingModel }
    );

    try {
      let jsonStr = result.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Convert indices to actual image groups
      const groups: string[][] = [];
      const usedIndices = new Set<number>();

      if (Array.isArray(parsed.groups)) {
        for (const group of parsed.groups) {
          if (Array.isArray(group.indices)) {
            const imageGroup: string[] = [];
            for (const idx of group.indices) {
              if (typeof idx === 'number' && idx >= 0 && idx < images.length) {
                imageGroup.push(images[idx]);
                usedIndices.add(idx);
              }
            }
            if (imageGroup.length > 0) {
              groups.push(imageGroup);
            }
          }
        }
      }

      // Add any unassigned images as individual recipes
      for (let i = 0; i < images.length; i++) {
        if (!usedIndices.has(i)) {
          groups.push([images[i]]);
        }
      }

      return {
        groups,
        notes: parsed.notes || '',
      };
    } catch (error) {
      // If parsing fails, treat each image as a separate recipe
      console.error('Failed to parse photo grouping response:', error);
      return {
        groups: images.map(img => [img]),
        notes: 'Failed to analyze groupings, treating each image as a separate recipe',
      };
    }
  }

  /**
   * Extract multiple recipes from multiple photo groups.
   * Each group is processed as a single recipe.
   * Uses parallel processing with concurrency limit for efficiency.
   */
  async extractRecipesFromPhotoGroups(
    imageGroups: string[][],
    onProgress?: (current: number, total: number, recipe?: ExtractedRecipe) => void
  ): Promise<ExtractedRecipe[]> {
    const total = imageGroups.length;
    const CONCURRENCY_LIMIT = 3; // Process up to 3 recipes in parallel

    // Results array initialized with placeholders
    const results: ExtractedRecipe[] = new Array(total);
    let completed = 0;

    // Process a single group at a given index
    const processGroup = async (index: number): Promise<void> => {
      const group = imageGroups[index];
      try {
        const recipe = await this.extractRecipeFromPhotos({ images: group });
        results[index] = recipe;
        completed++;
        onProgress?.(completed, total, recipe);
      } catch (error) {
        console.error(`Failed to extract recipe from group ${index + 1}:`, error);
        results[index] = {
          title: `Failed Recipe ${index + 1}`,
          description: `Failed to extract: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ingredients: [],
          instructions: [],
          tags: [],
          confidence: 0,
          extractionNotes: 'Extraction failed - please try again with clearer images',
        };
        completed++;
        onProgress?.(completed, total, undefined);
      }
    };

    // Process in batches with concurrency limit
    const indices = imageGroups.map((_, i) => i);
    for (let i = 0; i < indices.length; i += CONCURRENCY_LIMIT) {
      const batch = indices.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(processGroup));
    }

    return results;
  }
}

// Singleton instance
export const photoImportService = new PhotoImportService();
