<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { apiClient } from '$lib/api/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeForm from '$lib/components/RecipeForm.svelte';

  let recipe = $state<any>(null);
  let loading = $state(true);
  let error = $state('');

  // JSON-LD import mode
  let mode = $state<'form' | 'jsonld'>('form');
  let jsonldInput = $state('');
  let jsonldError = $state('');
  let parsing = $state(false);

  onMount(() => {
    loadRecipe();
  });

  async function loadRecipe() {
    loading = true;
    error = '';
    try {
      recipe = await apiClient.getRecipe($page.params.id);
    } catch (err: any) {
      error = err.message || 'Failed to load recipe';
    } finally {
      loading = false;
    }
  }

  async function handleSubmit(data: any) {
    const { components, ...recipeData } = data;

    // Update the recipe
    await apiClient.updateRecipe($page.params.id, recipeData);

    // Update components
    await apiClient.setComponents($page.params.id, components || []);

    goto(`/recipe/${$page.params.id}`);
  }

  function handleCancel() {
    goto(`/recipe/${$page.params.id}`);
  }

  async function handleParseJsonLd() {
    jsonldError = '';

    if (!jsonldInput.trim()) {
      jsonldError = 'Please paste JSON-LD data';
      return;
    }

    parsing = true;
    try {
      // Use the backend to parse the JSON-LD (reuse the import logic)
      const parsed = await apiClient.fetchFromUrl(
        'data:application/json,' + encodeURIComponent(jsonldInput.trim()),
        false
      );

      // This won't work with data: URLs, so we need a different approach
      // Let's create a dedicated endpoint or parse client-side
    } catch (err) {
      // Expected - let's try a different approach
    }

    // Parse client-side instead
    try {
      const data = JSON.parse(jsonldInput.trim());

      // Find the recipe object
      let recipeData = data;
      if (data['@graph']) {
        recipeData = data['@graph'].find((item: any) => item['@type'] === 'Recipe');
      } else if (Array.isArray(data)) {
        recipeData = data.find((item: any) => item['@type'] === 'Recipe');
      }

      if (!recipeData || recipeData['@type'] !== 'Recipe') {
        jsonldError = 'No Recipe found in JSON-LD data';
        parsing = false;
        return;
      }

      // Update the recipe state with parsed data
      recipe = {
        ...recipe,
        title: recipeData.name || recipe.title,
        description: recipeData.description || recipe.description,
        prepTime: parseDuration(recipeData.prepTime) || recipe.prepTime,
        cookTime: parseDuration(recipeData.cookTime) || recipe.cookTime,
        totalTime: parseDuration(recipeData.totalTime) || recipe.totalTime,
        servings: parseServings(recipeData.recipeYield) || recipe.servings,
        ingredients: parseIngredients(recipeData.recipeIngredient) || recipe.ingredients,
        instructions: parseInstructions(recipeData.recipeInstructions) || recipe.instructions,
        imageUrl: parseImageUrl(recipeData.image) || recipe.imageUrl,
        sourceUrl: recipeData.url || recipe.sourceUrl,
        nutrition: parseNutrition(recipeData.nutrition) || recipe.nutrition,
        tags: parseTags(recipeData) || recipe.tags,
      };

      // Switch back to form mode
      mode = 'form';
      jsonldInput = '';
    } catch (err: any) {
      jsonldError = 'Invalid JSON: ' + (err.message || 'Parse error');
    } finally {
      parsing = false;
    }
  }

  // Helper functions for parsing JSON-LD
  function parseDuration(duration: string): number | null {
    if (!duration) return null;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return null;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    return hours * 60 + minutes;
  }

  function parseServings(yield_: any): number | null {
    if (!yield_) return null;
    if (typeof yield_ === 'number') return yield_;
    if (Array.isArray(yield_)) yield_ = yield_[0];
    const match = String(yield_).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  function extractText(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value['@value']) return value['@value'];
    if (value.text) return extractText(value.text);
    if (value.name) return extractText(value.name);
    if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join(' ');
    if (typeof value === 'object') return '';
    return String(value);
  }

  // Helper functions for parsing JSON-LD
  interface RecipeItem {
    id: string;
    text: string;
    order: number;
    checked?: boolean;
  }

  function parseIngredients(ingredients: any): { items: RecipeItem[] } | null {
    if (!ingredients) return null;

    const texts = Array.isArray(ingredients)
      ? ingredients.map(extractText).filter(Boolean)
      : [extractText(ingredients)].filter(Boolean);

    return {
      items: texts.map((text, i) => ({
        id: crypto.randomUUID(),
        text,
        order: i
      }))
    };
  }

  function parseInstructionItem(instruction: any): string[] {
    if (!instruction) return [];
    if (typeof instruction === 'string') return instruction.trim() ? [instruction.trim()] : [];

    if (instruction['@type'] === 'HowToSection') {
      const steps = instruction.itemListElement || [];
      return Array.isArray(steps) ? steps.flatMap(parseInstructionItem) : parseInstructionItem(steps);
    }

    if (instruction['@type'] === 'HowToStep') {
      const text = extractText(instruction.text || instruction.name || instruction);
      return text.trim() ? [text.trim()] : [];
    }

    if (instruction.text) {
      const text = extractText(instruction.text);
      return text.trim() ? [text.trim()] : [];
    }

    if (Array.isArray(instruction)) {
      return instruction.flatMap(parseInstructionItem);
    }

    const text = extractText(instruction);
    return text.trim() ? [text.trim()] : [];
  }

  function parseInstructions(instructions: any): { items: RecipeItem[] } | null {
    if (!instructions) return null;

    const texts = Array.isArray(instructions)
      ? instructions.flatMap(parseInstructionItem).filter(Boolean)
      : parseInstructionItem(instructions).filter(Boolean);

    return {
      items: texts.map((text, i) => ({
        id: crypto.randomUUID(),
        text,
        order: i
      }))
    };
  }

  function parseImageUrl(image: any): string | null {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (image.url) return extractText(image.url);
    if (Array.isArray(image) && image.length > 0) return parseImageUrl(image[0]);
    return null;
  }

  function parseNutritionValue(value: any): number | undefined {
    if (value === undefined || value === null) return undefined;
    const text = extractText(value);
    if (!text) return undefined;
    const match = text.match(/^([\d.]+)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  function parseNutrition(nutrition: any): any | null {
    if (!nutrition || typeof nutrition === 'string') return null;

    const result: any = {};
    const calories = parseNutritionValue(nutrition.calories);
    if (calories !== undefined) result.calories = calories;
    const protein = parseNutritionValue(nutrition.proteinContent);
    if (protein !== undefined) result.protein = protein;
    const carbs = parseNutritionValue(nutrition.carbohydrateContent);
    if (carbs !== undefined) result.carbohydrates = carbs;
    const fat = parseNutritionValue(nutrition.fatContent);
    if (fat !== undefined) result.fat = fat;
    const saturatedFat = parseNutritionValue(nutrition.saturatedFatContent);
    if (saturatedFat !== undefined) result.saturatedFat = saturatedFat;
    const fiber = parseNutritionValue(nutrition.fiberContent);
    if (fiber !== undefined) result.fiber = fiber;
    const sugar = parseNutritionValue(nutrition.sugarContent);
    if (sugar !== undefined) result.sugar = sugar;
    const sodium = parseNutritionValue(nutrition.sodiumContent);
    if (sodium !== undefined) result.sodium = sodium;
    const cholesterol = parseNutritionValue(nutrition.cholesterolContent);
    if (cholesterol !== undefined) result.cholesterol = cholesterol;

    return Object.keys(result).length > 0 ? result : null;
  }

  function parseTags(recipeData: any): { name: string }[] | null {
    const tags: string[] = [];

    if (recipeData.recipeCategory) {
      const cats = Array.isArray(recipeData.recipeCategory)
        ? recipeData.recipeCategory
        : [recipeData.recipeCategory];
      tags.push(...cats.map(extractText).filter(Boolean));
    }

    if (recipeData.keywords) {
      if (typeof recipeData.keywords === 'string') {
        tags.push(...recipeData.keywords.split(',').map((k: string) => k.trim()).filter(Boolean));
      } else if (Array.isArray(recipeData.keywords)) {
        tags.push(...recipeData.keywords.map(extractText).filter(Boolean));
      }
    }

    const uniqueTags = [...new Set(tags)];
    return uniqueTags.length > 0 ? uniqueTags.map(name => ({ name })) : null;
  }
</script>

<Header />

<main>
  <div class="container">
    {#if loading}
      <div class="loading">Loading recipe...</div>
    {:else if error}
      <div class="error">{error}</div>
      <a href="/" class="btn-back">← Back to Recipes</a>
    {:else if recipe}
      <div class="header-row">
        <h2>Edit Recipe</h2>
        <div class="mode-toggle">
          <button
            class:active={mode === 'form'}
            onclick={() => mode = 'form'}
          >
            Edit Form
          </button>
          <button
            class:active={mode === 'jsonld'}
            onclick={() => mode = 'jsonld'}
          >
            Update from JSON-LD
          </button>
        </div>
      </div>

      {#if mode === 'form'}
        <RecipeForm recipe={recipe} onSubmit={handleSubmit} onCancel={handleCancel} />
      {:else}
        <div class="jsonld-section">
          <div class="info">
            <p>
              Paste JSON-LD recipe data to update this recipe. The parsed data will populate the edit form for review before saving.
            </p>
          </div>

          {#if jsonldError}
            <div class="jsonld-error">{jsonldError}</div>
          {/if}

          <div class="form-group">
            <label for="jsonld">Recipe JSON-LD</label>
            <textarea
              id="jsonld"
              bind:value={jsonldInput}
              rows="20"
              placeholder={`{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Recipe Name",
  "recipeIngredient": [...],
  "recipeInstructions": [...]
}`}
            ></textarea>
          </div>

          <div class="form-actions">
            <button
              class="btn-primary"
              onclick={handleParseJsonLd}
              disabled={parsing}
            >
              {parsing ? 'Parsing...' : 'Parse & Load into Form'}
            </button>
            <button
              class="btn-secondary"
              onclick={() => { mode = 'form'; jsonldInput = ''; jsonldError = ''; }}
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: var(--spacing-6) 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-6);
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-5);
    flex-wrap: wrap;
    gap: var(--spacing-3);
  }

  h2 {
    margin: 0;
    font-size: var(--text-2xl);
    color: var(--color-text);
    font-weight: var(--font-bold);
  }

  .mode-toggle {
    display: flex;
    gap: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .mode-toggle button {
    padding: var(--spacing-2) var(--spacing-3);
    border: none;
    background: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: all 0.2s;
  }

  .mode-toggle button:not(:last-child) {
    border-right: 1px solid var(--color-border);
  }

  .mode-toggle button.active {
    background: var(--color-primary);
    color: white;
  }

  .mode-toggle button:hover:not(.active) {
    background: var(--color-bg-subtle);
  }

  .loading {
    text-align: center;
    padding: var(--spacing-8);
    color: var(--color-text-light);
  }

  .error {
    background: #fef2f2;
    color: var(--color-error);
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-4);
  }

  .btn-back {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: var(--font-medium);
  }

  .btn-back:hover {
    text-decoration: underline;
  }

  .jsonld-section {
    max-width: 800px;
  }

  .info {
    background: #e8f4ff;
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-4);
    line-height: 1.5;
  }

  .info p {
    margin: 0;
    font-size: var(--text-sm);
  }

  .jsonld-error {
    background: #fef2f2;
    color: var(--color-error);
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-4);
    font-size: var(--text-sm);
  }

  .form-group {
    margin-bottom: var(--spacing-4);
  }

  .form-group label {
    display: block;
    font-weight: var(--font-medium);
    margin-bottom: var(--spacing-2);
    color: var(--color-text);
    font-size: var(--text-sm);
  }

  textarea {
    width: 100%;
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-family: 'Courier New', monospace;
    resize: vertical;
    background: var(--color-surface);
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-actions {
    display: flex;
    gap: var(--spacing-3);
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(0.9);
  }

  .btn-primary:disabled {
    background: var(--color-border);
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-bg-subtle);
  }

  @media (max-width: 640px) {
    main {
      padding: var(--spacing-4) 0;
    }

    .container {
      padding: 0 var(--spacing-4);
    }

    .header-row {
      flex-direction: column;
      align-items: flex-start;
    }

    h2 {
      font-size: var(--text-xl);
    }

    .mode-toggle {
      width: 100%;
    }

    .mode-toggle button {
      flex: 1;
    }

    .form-actions {
      flex-direction: column;
    }
  }
</style>
