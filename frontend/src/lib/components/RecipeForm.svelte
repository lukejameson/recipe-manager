<script lang="ts">
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

  <div class="form-actions">
    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? 'Saving...' : recipe ? 'Update Recipe' : 'Create Recipe'}
    </button>
    <button type="button" class="btn-secondary" onclick={onCancel}>Cancel</button>
  </div>
</form>

<style>
  .recipe-form {
    max-width: 800px;
    margin: 0 auto;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #333;
  }

  input,
  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }

  textarea {
    resize: vertical;
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: #4a9eff;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
  }

  .btn-primary {
    background: #4a9eff;
    color: white;
    flex: 1;
  }

  .btn-primary:hover:not(:disabled) {
    background: #3a8eef;
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
    .form-actions {
      flex-direction: column;
    }
  }
</style>
