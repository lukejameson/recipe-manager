<script lang="ts">
  import { onMount } from 'svelte';
  import { trpc } from '$lib/trpc/client';
  import AddComponentModal from './AddComponentModal.svelte';

  let {
    recipe = null,
    onSubmit,
    onCancel,
  }: {
    recipe?: any;
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
  } = $props();

  let title = $state(recipe?.title || '');
  let description = $state(recipe?.description || '');
  let prepTime = $state(recipe?.prepTime || '');
  let cookTime = $state(recipe?.cookTime || '');
  let totalTime = $state(recipe?.totalTime || '');
  let servings = $state(recipe?.servings || '');
  let imageUrl = $state(recipe?.imageUrl || '');
  let sourceUrl = $state(recipe?.sourceUrl || '');
  let ingredients = $state(recipe?.ingredients?.join('\n') || '');
  let instructions = $state(recipe?.instructions?.join('\n') || '');
  let tags = $state(recipe?.tags?.map((t: any) => t.name).join(', ') || '');
  let loading = $state(false);
  let error = $state('');

  // Components for compound recipes
  let showComponents = $state(false);
  let showComponentModal = $state(false);
  let components = $state<Array<{ childRecipeId: string; servingsNeeded: number; childRecipe: any }>>([]);

  // Load existing components when editing
  onMount(async () => {
    if (recipe?.id) {
      try {
        const existingComponents = await trpc.recipe.getComponents.query({ recipeId: recipe.id });
        if (existingComponents.length > 0) {
          components = existingComponents.map((c: any) => ({
            childRecipeId: c.childRecipeId,
            servingsNeeded: c.servingsNeeded,
            childRecipe: c.childRecipe,
          }));
          showComponents = true;
        }
      } catch (err) {
        // Ignore errors loading components
      }
    }
  });

  function handleAddComponent(childRecipe: any, servingsNeeded: number) {
    components = [...components, { childRecipeId: childRecipe.id, servingsNeeded, childRecipe }];
    showComponentModal = false;
  }

  function handleRemoveComponent(index: number) {
    components = components.filter((_, i) => i !== index);
  }

  function handleUpdateServings(index: number, value: string) {
    const newServings = parseFloat(value);
    if (!isNaN(newServings) && newServings > 0) {
      components = components.map((c, i) =>
        i === index ? { ...c, servingsNeeded: newServings } : c
      );
    }
  }

  // Get IDs to exclude from the add modal (current recipe + already added)
  const excludeRecipeIds = $derived([
    ...(recipe?.id ? [recipe.id] : []),
    ...components.map((c) => c.childRecipeId),
  ]);

  // Nutrition fields (per serving)
  let showNutrition = $state(!!recipe?.nutrition);
  let calories = $state(recipe?.nutrition?.calories || '');
  let protein = $state(recipe?.nutrition?.protein || '');
  let carbohydrates = $state(recipe?.nutrition?.carbohydrates || '');
  let fat = $state(recipe?.nutrition?.fat || '');
  let saturatedFat = $state(recipe?.nutrition?.saturatedFat || '');
  let fiber = $state(recipe?.nutrition?.fiber || '');
  let sugar = $state(recipe?.nutrition?.sugar || '');
  let sodium = $state(recipe?.nutrition?.sodium || '');
  let cholesterol = $state(recipe?.nutrition?.cholesterol || '');

  async function handleSubmit() {
    error = '';

    // Validation
    if (!title.trim()) {
      error = 'Title is required';
      return;
    }

    const ingredientList = ingredients
      .split('\n')
      .map((i) => i.trim())
      .filter(Boolean);

    if (ingredientList.length === 0) {
      error = 'At least one ingredient is required';
      return;
    }

    const instructionList = instructions
      .split('\n')
      .map((i) => i.trim())
      .filter(Boolean);

    if (instructionList.length === 0) {
      error = 'At least one instruction is required';
      return;
    }

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Build nutrition object only if any nutrition values are provided
    let nutrition: Record<string, number> | undefined = undefined;
    if (showNutrition) {
      const nutritionData: Record<string, number> = {};
      if (calories) nutritionData.calories = parseFloat(calories);
      if (protein) nutritionData.protein = parseFloat(protein);
      if (carbohydrates) nutritionData.carbohydrates = parseFloat(carbohydrates);
      if (fat) nutritionData.fat = parseFloat(fat);
      if (saturatedFat) nutritionData.saturatedFat = parseFloat(saturatedFat);
      if (fiber) nutritionData.fiber = parseFloat(fiber);
      if (sugar) nutritionData.sugar = parseFloat(sugar);
      if (sodium) nutritionData.sodium = parseFloat(sodium);
      if (cholesterol) nutritionData.cholesterol = parseFloat(cholesterol);

      if (Object.keys(nutritionData).length > 0) {
        nutrition = nutritionData;
      }
    }

    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      prepTime: prepTime ? parseInt(prepTime) : undefined,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      totalTime: totalTime ? parseInt(totalTime) : undefined,
      servings: servings ? parseInt(servings) : undefined,
      imageUrl: imageUrl.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      ingredients: ingredientList,
      instructions: instructionList,
      tags: tagList,
      nutrition,
      // Include components data for the parent to handle
      components: components.map((c) => ({
        childRecipeId: c.childRecipeId,
        servingsNeeded: c.servingsNeeded,
      })),
    };

    loading = true;
    try {
      await onSubmit(data);
    } catch (err: any) {
      error = err.message || 'Failed to save recipe';
      loading = false;
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="recipe-form">
  {#if error}
    <div class="error">{error}</div>
  {/if}

  <div class="form-group">
    <label for="title">Title *</label>
    <input id="title" type="text" bind:value={title} required maxlength="200" />
  </div>

  <div class="form-group">
    <label for="description">Description</label>
    <textarea id="description" bind:value={description} rows="3" maxlength="1000"></textarea>
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="prepTime">Prep Time (minutes)</label>
      <input id="prepTime" type="number" bind:value={prepTime} min="0" />
    </div>

    <div class="form-group">
      <label for="cookTime">Cook Time (minutes)</label>
      <input id="cookTime" type="number" bind:value={cookTime} min="0" />
    </div>

    <div class="form-group">
      <label for="totalTime">Total Time (minutes)</label>
      <input id="totalTime" type="number" bind:value={totalTime} min="0" />
    </div>

    <div class="form-group">
      <label for="servings">Servings</label>
      <input id="servings" type="number" bind:value={servings} min="1" />
    </div>
  </div>

  <div class="form-group">
    <label for="ingredients">Ingredients * (one per line)</label>
    <textarea
      id="ingredients"
      bind:value={ingredients}
      rows="8"
      required
      placeholder="2 cups flour&#10;1 cup sugar&#10;1 tsp vanilla"
    ></textarea>
  </div>

  <div class="form-group">
    <label for="instructions">Instructions * (one per line)</label>
    <textarea
      id="instructions"
      bind:value={instructions}
      rows="10"
      required
      placeholder="Preheat oven to 350°F&#10;Mix dry ingredients&#10;Bake for 30 minutes"
    ></textarea>
  </div>

  <div class="form-group">
    <label for="tags">Tags (comma-separated)</label>
    <input
      id="tags"
      type="text"
      bind:value={tags}
      placeholder="dessert, chocolate, cookies"
    />
  </div>

  <div class="form-group">
    <label for="imageUrl">Image URL</label>
    <input id="imageUrl" type="url" bind:value={imageUrl} />
  </div>

  <div class="form-group">
    <label for="sourceUrl">Source URL</label>
    <input id="sourceUrl" type="url" bind:value={sourceUrl} />
  </div>

  <!-- Nutrition Section -->
  <div class="nutrition-section">
    <button
      type="button"
      class="nutrition-toggle"
      onclick={() => showNutrition = !showNutrition}
    >
      {showNutrition ? '▼' : '▶'} Nutrition Information (per serving)
    </button>

    {#if showNutrition}
      <div class="nutrition-fields">
        <div class="nutrition-row">
          <div class="form-group">
            <label for="calories">Calories (kcal)</label>
            <input id="calories" type="number" bind:value={calories} min="0" step="1" />
          </div>
          <div class="form-group">
            <label for="protein">Protein (g)</label>
            <input id="protein" type="number" bind:value={protein} min="0" step="0.1" />
          </div>
          <div class="form-group">
            <label for="carbohydrates">Carbohydrates (g)</label>
            <input id="carbohydrates" type="number" bind:value={carbohydrates} min="0" step="0.1" />
          </div>
        </div>

        <div class="nutrition-row">
          <div class="form-group">
            <label for="fat">Fat (g)</label>
            <input id="fat" type="number" bind:value={fat} min="0" step="0.1" />
          </div>
          <div class="form-group">
            <label for="saturatedFat">Saturated Fat (g)</label>
            <input id="saturatedFat" type="number" bind:value={saturatedFat} min="0" step="0.1" />
          </div>
          <div class="form-group">
            <label for="fiber">Fiber (g)</label>
            <input id="fiber" type="number" bind:value={fiber} min="0" step="0.1" />
          </div>
        </div>

        <div class="nutrition-row">
          <div class="form-group">
            <label for="sugar">Sugar (g)</label>
            <input id="sugar" type="number" bind:value={sugar} min="0" step="0.1" />
          </div>
          <div class="form-group">
            <label for="sodium">Sodium (mg)</label>
            <input id="sodium" type="number" bind:value={sodium} min="0" step="1" />
          </div>
          <div class="form-group">
            <label for="cholesterol">Cholesterol (mg)</label>
            <input id="cholesterol" type="number" bind:value={cholesterol} min="0" step="1" />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Components Section (for compound recipes) -->
  <div class="components-section">
    <button
      type="button"
      class="components-toggle"
      onclick={() => showComponents = !showComponents}
    >
      {showComponents ? '▼' : '▶'} Components (Compound Recipe)
      {#if components.length > 0}
        <span class="component-count">{components.length}</span>
      {/if}
    </button>

    {#if showComponents}
      <div class="components-content">
        <p class="components-hint">
          Add other recipes as components to create a compound recipe. Each component will be displayed as a collapsible section.
        </p>

        {#if components.length > 0}
          <div class="component-list">
            {#each components as comp, index}
              <div class="component-item">
                <div class="component-info">
                  <span class="component-title">{comp.childRecipe.title}</span>
                  {#if comp.childRecipe.servings}
                    <span class="component-recipe-servings">
                      (recipe makes {comp.childRecipe.servings} servings)
                    </span>
                  {/if}
                </div>
                <div class="component-controls">
                  <label class="servings-label">
                    Servings:
                    <input
                      type="number"
                      value={comp.servingsNeeded}
                      onchange={(e) => handleUpdateServings(index, e.currentTarget.value)}
                      min="0.1"
                      step="0.5"
                      class="servings-input"
                    />
                  </label>
                  <button
                    type="button"
                    class="btn-remove"
                    onclick={() => handleRemoveComponent(index)}
                    title="Remove component"
                  >
                    &times;
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <button
          type="button"
          class="btn-add-component"
          onclick={() => showComponentModal = true}
        >
          + Add Component Recipe
        </button>
      </div>
    {/if}
  </div>

  <div class="form-actions">
    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? 'Saving...' : recipe ? 'Update Recipe' : 'Create Recipe'}
    </button>
    <button type="button" class="btn-secondary" onclick={onCancel}>Cancel</button>
  </div>
</form>

{#if showComponentModal}
  <AddComponentModal
    onAdd={handleAddComponent}
    onClose={() => showComponentModal = false}
    {excludeRecipeIds}
  />
{/if}

<style>
  .recipe-form {
    max-width: 800px;
    margin: 0 auto;
  }

  .error {
    background: #fef2f2;
    color: var(--color-error);
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
    border: 1px solid #fecaca;
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
  }

  .form-group {
    margin-bottom: var(--spacing-5);
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-4);
  }

  label {
    display: block;
    font-weight: var(--font-semibold);
    margin-bottom: var(--spacing-2);
    color: var(--color-text);
    font-size: var(--text-sm);
  }

  input,
  textarea {
    width: 100%;
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-family: inherit;
    background: var(--color-surface);
    color: var(--color-text);
    transition: var(--transition-normal);
  }

  textarea {
    resize: vertical;
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
  }

  .form-actions {
    display: flex;
    gap: var(--spacing-4);
    margin-top: var(--spacing-8);
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-3) var(--spacing-5);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    cursor: pointer;
    border: 2px solid transparent;
    transition: var(--transition-normal);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
    flex: 1;
    border-color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .btn-primary:disabled {
    background: var(--color-border);
    border-color: var(--color-border);
    color: var(--color-text-light);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border-color: var(--color-border);
    box-shadow: var(--shadow-xs);
  }

  .btn-secondary:hover {
    background: var(--color-bg-subtle);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  /* Nutrition section styles */
  .nutrition-section {
    margin-bottom: var(--spacing-5);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .nutrition-toggle {
    width: 100%;
    padding: var(--spacing-4);
    background: var(--color-bg-subtle);
    border: none;
    text-align: left;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    cursor: pointer;
    transition: var(--transition-normal);
  }

  .nutrition-toggle:hover {
    background: var(--color-border-light);
  }

  .nutrition-fields {
    padding: var(--spacing-4);
    background: var(--color-surface);
  }

  .nutrition-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-4);
  }

  .nutrition-row:last-child {
    margin-bottom: 0;
  }

  .nutrition-row .form-group {
    margin-bottom: 0;
  }

  .nutrition-row input {
    text-align: right;
  }

  /* Components section styles */
  .components-section {
    margin-bottom: var(--spacing-5);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .components-toggle {
    width: 100%;
    padding: var(--spacing-4);
    background: var(--color-bg-subtle);
    border: none;
    text-align: left;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    cursor: pointer;
    transition: var(--transition-normal);
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .components-toggle:hover {
    background: var(--color-border-light);
  }

  .component-count {
    background: var(--color-primary);
    color: white;
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    min-width: 20px;
    text-align: center;
  }

  .components-content {
    padding: var(--spacing-4);
    background: var(--color-surface);
  }

  .components-hint {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: 0 0 var(--spacing-4) 0;
    line-height: 1.5;
  }

  .component-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-4);
  }

  .component-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-light);
  }

  .component-info {
    flex: 1;
    min-width: 0;
  }

  .component-title {
    font-weight: var(--font-medium);
    color: var(--color-text);
    display: block;
  }

  .component-recipe-servings {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .component-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .servings-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .servings-input {
    width: 70px;
    padding: var(--spacing-2);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    text-align: center;
  }

  .btn-remove {
    background: none;
    border: none;
    font-size: var(--text-xl);
    color: var(--color-text-light);
    cursor: pointer;
    padding: var(--spacing-1);
    line-height: 1;
    transition: var(--transition-fast);
  }

  .btn-remove:hover {
    color: var(--color-error);
  }

  .btn-add-component {
    width: 100%;
    padding: var(--spacing-3);
    background: var(--color-surface);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-primary);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-add-component:hover {
    background: rgba(255, 107, 53, 0.05);
    border-color: var(--color-primary);
  }

  @media (max-width: 640px) {
    .form-actions {
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .btn-primary,
    .btn-secondary {
      padding: var(--spacing-4) var(--spacing-6);
      font-size: var(--text-lg);
      min-height: 52px;
    }

    .nutrition-row {
      grid-template-columns: 1fr;
      gap: var(--spacing-3);
    }

    .component-item {
      flex-direction: column;
      align-items: flex-start;
    }

    .component-controls {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
