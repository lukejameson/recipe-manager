<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
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
      recipe = await trpc.recipe.get.query({ id: $page.params.id });
    } catch (err: any) {
      error = err.message || 'Failed to load recipe';
    } finally {
      loading = false;
    }
  }

  async function handleSubmit(data: any) {
    const { components, ...recipeData } = data;

    // Update the recipe
    await trpc.recipe.update.mutate({ id: $page.params.id, data: recipeData });

    // Update components
    await trpc.recipe.setComponents.mutate({
      recipeId: $page.params.id,
      components: components || [],
    });

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
      const parsed = await trpc.recipe.fetchFromUrl.mutate({
        url: 'data:application/json,' + encodeURIComponent(jsonldInput.trim()),
        convertToMetric: false,
      });

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

  function parseIngredients(ingredients: any): string[] | null {
    if (!ingredients) return null;
    if (Array.isArray(ingredients)) {
      return ingredients.map(extractText).filter(Boolean);
    }
    const text = extractText(ingredients);
    return text ? [text] : null;
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

  function parseInstructions(instructions: any): string[] | null {
    if (!instructions) return null;
    if (Array.isArray(instructions)) {
      return instructions.flatMap(parseInstructionItem).filter(Boolean);
    }
    return parseInstructionItem(instructions).filter(Boolean);
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
    padding: 2rem 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  h2 {
    margin: 0;
    font-size: 2rem;
    color: #333;
  }

  .mode-toggle {
    display: flex;
    gap: 0;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #ddd;
  }

  .mode-toggle button {
    padding: 0.5rem 1rem;
    border: none;
    background: white;
    color: #666;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .mode-toggle button:not(:last-child) {
    border-right: 1px solid #ddd;
  }

  .mode-toggle button.active {
    background: var(--color-primary, #ff6b35);
    color: white;
  }

  .mode-toggle button:hover:not(.active) {
    background: #f5f5f5;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .btn-back {
    color: #4a9eff;
    text-decoration: none;
    font-weight: 500;
  }

  .btn-back:hover {
    text-decoration: underline;
  }

  .jsonld-section {
    max-width: 800px;
  }

  .info {
    background: #e8f4ff;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .info p {
    margin: 0;
  }

  .jsonld-error {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #333;
  }

  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: 'Courier New', monospace;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary, #ff6b35);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--color-primary, #ff6b35);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(0.9);
  }

  .btn-primary:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    color: #666;
    border: 1px solid #ddd;
  }

  .btn-secondary:hover {
    background: #f5f5f5;
  }

  @media (max-width: 640px) {
    .header-row {
      flex-direction: column;
      align-items: flex-start;
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
