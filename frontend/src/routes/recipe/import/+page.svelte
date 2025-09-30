<script lang="ts">
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeForm from '$lib/components/RecipeForm.svelte';

  let mode = $state<'url' | 'jsonld' | 'preview'>('url');
  let url = $state('');
  let jsonld = $state('');
  let fetchedRecipe = $state<any>(null);
  let loading = $state(false);
  let error = $state('');
  let convertToMetric = $state(true); // Default to true for metric conversion

  async function handleFetchFromUrl() {
    error = '';

    if (!url.trim()) {
      error = 'Please enter a URL';
      return;
    }

    loading = true;
    try {
      fetchedRecipe = await trpc.recipe.fetchFromUrl.mutate({
        url: url.trim(),
        convertToMetric
      });
      mode = 'preview';
    } catch (err: any) {
      error = err.message || 'Failed to fetch recipe from URL';
    } finally {
      loading = false;
    }
  }

  async function handleImportJsonLd() {
    error = '';

    if (!jsonld.trim()) {
      error = 'Please paste JSONLD code';
      return;
    }

    loading = true;
    try {
      await trpc.recipe.importJsonLd.mutate({ jsonld: jsonld.trim() });
      goto('/');
    } catch (err: any) {
      error = err.message || 'Failed to import recipe';
      loading = false;
    }
  }

  async function handleSaveRecipe(data: any) {
    await trpc.recipe.create.mutate(data);
    goto('/');
  }

  function handleCancel() {
    if (mode === 'preview') {
      mode = 'url';
      fetchedRecipe = null;
      error = '';
    } else {
      goto('/');
    }
  }
</script>

<Header />

<main>
  <div class="container">
    <h2>Import Recipe</h2>

    {#if mode === 'preview' && fetchedRecipe}
      <div class="info">
        <p>✅ Recipe fetched successfully! Review and edit the details below, then save.</p>
      </div>
      <RecipeForm recipe={fetchedRecipe} onSubmit={handleSaveRecipe} onCancel={handleCancel} />
    {:else}
      <div class="mode-toggle">
        <button
          class:active={mode === 'url'}
          onclick={() => { mode = 'url'; error = ''; }}
        >
          From URL
        </button>
        <button
          class:active={mode === 'jsonld'}
          onclick={() => { mode = 'jsonld'; error = ''; }}
        >
          From JSONLD
        </button>
      </div>

      {#if error}
        <div class="error">{error}</div>
      {/if}

      {#if mode === 'url'}
        <div class="info">
          <p>
            Enter the URL of a recipe page. The app will automatically fetch and extract the recipe data.
          </p>
          <p>
            <strong>Supported sites:</strong> Any website with Schema.org Recipe JSONLD markup
            (most major recipe websites like AllRecipes, Food Network, NYT Cooking, etc.)
          </p>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); handleFetchFromUrl(); }}>
          <div class="form-group">
            <label for="url">Recipe URL</label>
            <input
              id="url"
              type="url"
              bind:value={url}
              required
              placeholder="https://example.com/recipe-name"
            />
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" bind:checked={convertToMetric} />
              <span>Convert imperial units to metric (cups → ml, oz → g, etc.)</span>
            </label>
            <p class="help-text">
              Automatically converts measurements like cups, ounces, and pounds to milliliters, grams, and kilograms.
              Works with various formats like "1/2 cup", "2 cups", "8 oz", etc.
            </p>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary" disabled={loading}>
              {loading ? 'Fetching Recipe...' : 'Fetch Recipe'}
            </button>
            <button type="button" class="btn-secondary" onclick={() => goto('/')}>
              Cancel
            </button>
          </div>
        </form>
      {:else}
        <div class="info">
          <p>
            Many recipe websites include Schema.org/Recipe JSONLD in their pages. To find it:
          </p>
          <ol>
            <li>Open the recipe page in your browser</li>
            <li>View the page source (right-click → View Page Source)</li>
            <li>Search for <code>"@type": "Recipe"</code></li>
            <li>Copy the entire JSON object (from <code>{`{`}</code> to <code>{`}`}</code>)</li>
            <li>Paste it below</li>
          </ol>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); handleImportJsonLd(); }}>
          <div class="form-group">
            <label for="jsonld">Recipe JSONLD</label>
            <textarea
              id="jsonld"
              bind:value={jsonld}
              rows="20"
              placeholder={`{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Chocolate Chip Cookies",
  "description": "Classic homemade cookies",
  "prepTime": "PT15M",
  "cookTime": "PT10M",
  "recipeYield": "24",
  "recipeIngredient": [
    "2 cups flour",
    "1 cup butter"
  ],
  "recipeInstructions": [
    {
      "@type": "HowToStep",
      "text": "Preheat oven to 350°F"
    }
  ]
}`}
            ></textarea>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary" disabled={loading}>
              {loading ? 'Importing...' : 'Import Recipe'}
            </button>
            <button type="button" class="btn-secondary" onclick={() => goto('/')}>
              Cancel
            </button>
          </div>
        </form>
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
    max-width: 900px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  h2 {
    margin: 0 0 1.5rem;
    font-size: 2rem;
    color: #333;
  }

  .mode-toggle {
    display: flex;
    gap: 0;
    margin-bottom: 2rem;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #ddd;
    width: fit-content;
  }

  .mode-toggle button {
    padding: 0.75rem 1.5rem;
    border: none;
    background: white;
    color: #666;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .mode-toggle button:not(:last-child) {
    border-right: 1px solid #ddd;
  }

  .mode-toggle button.active {
    background: #4a9eff;
    color: white;
  }

  .mode-toggle button:hover:not(.active) {
    background: #f5f5f5;
  }

  .info {
    background: #e8f4ff;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    line-height: 1.6;
  }

  .info p {
    margin: 0 0 1rem;
  }

  .info p:last-child {
    margin-bottom: 0;
  }

  .info ol {
    margin: 0;
    padding-left: 1.5rem;
  }

  .info li {
    margin-bottom: 0.5rem;
  }

  .info code {
    background: white;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
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

  .checkbox-group {
    background: #f9f9f9;
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
  }

  .checkbox-group label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-weight: normal;
    cursor: pointer;
  }

  .checkbox-group input[type="checkbox"] {
    margin-top: 0.25rem;
    cursor: pointer;
  }

  .checkbox-group span {
    font-weight: 500;
  }

  .help-text {
    margin: 0.5rem 0 0 1.75rem;
    font-size: 0.875rem;
    color: #666;
    line-height: 1.4;
  }

  label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #333;
  }

  input[type='url'] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
  }

  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: 'Courier New', monospace;
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

    .mode-toggle {
      width: 100%;
    }

    .mode-toggle button {
      flex: 1;
    }
  }
</style>
