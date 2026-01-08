<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import Header from '$lib/components/Header.svelte';
  import RecipeForm from '$lib/components/RecipeForm.svelte';
  import PhotoUploader from '$lib/components/PhotoUploader.svelte';
  import PhotoGrouper from '$lib/components/PhotoGrouper.svelte';
  import BulkRecipeReview from '$lib/components/BulkRecipeReview.svelte';

  type ImportMode = 'url' | 'jsonld' | 'photos' | 'preview';
  type PhotoStep = 'upload' | 'group' | 'extract' | 'review';

  // Feature flags
  let hasJsonldImport = $derived(authStore.hasFeature('jsonldImport'));
  let hasPhotoExtraction = $derived(authStore.hasFeature('photoExtraction'));

  const DRAFT_STORAGE_KEY = 'recipe-photo-import-draft';

  interface PhotoImportDraft {
    photos: string[];
    photoGroups: number[][];
    photoStep: PhotoStep;
    savedAt: number;
  }

  let mode = $state<ImportMode>('url');
  let url = $state('');
  let jsonld = $state('');
  let fetchedRecipe = $state<any>(null);
  let loading = $state(false);
  let error = $state('');
  let convertToMetric = $state(true);

  // Photo import state
  let photoStep = $state<PhotoStep>('upload');
  let photos = $state<string[]>([]);
  let photoGroups = $state<number[][]>([]);
  let extractedRecipes = $state<any[]>([]);
  let extractedImageGroups = $state<string[][]>([]);
  let extractionProgress = $state({ current: 0, total: 0 });
  let extracting = $state(false);
  let saving = $state(false);
  let hasDraft = $state(false);
  let draftSavedAt = $state<Date | null>(null);

  // Economy mode - uses higher compression to reduce API costs
  let economyMode = $state(false);
  const compressionLevel = $derived(economyMode ? 'high' : 'standard') as 'standard' | 'high';

  // Load draft on mount and check for quick photo import
  onMount(() => {
    loadDraft();

    // Check for quick photo import from home page
    const quickPhoto = sessionStorage.getItem('quickPhotoImport');
    if (quickPhoto) {
      sessionStorage.removeItem('quickPhotoImport');
      // Switch to photo mode and add the photo
      mode = 'photos';
      photos = [quickPhoto];
      // Auto-trigger extraction after a brief delay to let the UI update
      setTimeout(() => {
        handleExtractRecipes([photos]);
      }, 100);
    }
  });

  // Auto-save draft when photos or groups change
  $effect(() => {
    if (photos.length > 0 && (photoStep === 'upload' || photoStep === 'group')) {
      saveDraft();
    }
  });

  function saveDraft() {
    try {
      const draft: PhotoImportDraft = {
        photos,
        photoGroups,
        photoStep,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      draftSavedAt = new Date(draft.savedAt);
    } catch (err) {
      // Ignore storage errors (e.g., quota exceeded)
      console.warn('Failed to save draft:', err);
    }
  }

  function loadDraft() {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const draft: PhotoImportDraft = JSON.parse(stored);
        // Only restore if draft is less than 24 hours old
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - draft.savedAt < maxAge && draft.photos.length > 0) {
          hasDraft = true;
          draftSavedAt = new Date(draft.savedAt);
        }
      }
    } catch (err) {
      // Ignore parse errors
    }
  }

  function restoreDraft() {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const draft: PhotoImportDraft = JSON.parse(stored);
        photos = draft.photos;
        photoGroups = draft.photoGroups;
        photoStep = draft.photoStep;
        mode = 'photos';
        hasDraft = false;
      }
    } catch (err) {
      error = 'Failed to restore draft';
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      hasDraft = false;
      draftSavedAt = null;
    } catch (err) {
      // Ignore
    }
  }

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

  // Photo import functions
  function handlePhotosNext() {
    if (photos.length === 0) {
      error = 'Please upload at least one photo';
      return;
    }
    error = '';

    // If only one photo, skip grouping and go straight to extraction
    if (photos.length === 1) {
      handleExtractRecipes([photos]);
    } else {
      // Default: all photos in one group (one recipe)
      photoGroups = [photos.map((_, i) => i)];
      photoStep = 'group';
    }
  }

  // Quick extract - skip grouping and extract all as one recipe
  function handleQuickExtract() {
    if (photos.length === 0) {
      error = 'Please upload at least one photo';
      return;
    }
    error = '';
    handleExtractRecipes([photos]);
  }

  async function handleExtractRecipes(imageGroups: string[][]) {
    error = '';
    extracting = true;
    extractionProgress = { current: 0, total: imageGroups.length };
    photoStep = 'extract';
    extractedImageGroups = imageGroups;

    try {
      const result = await trpc.recipe.bulkExtractFromPhotos.mutate({ imageGroups });
      extractedRecipes = result.recipes;
      photoStep = 'review';
    } catch (err: any) {
      error = err.message || 'Failed to extract recipes from photos';
      photoStep = 'group';
    } finally {
      extracting = false;
    }
  }

  async function handleRetryExtraction(groupIndex: number): Promise<any | null> {
    if (!extractedImageGroups[groupIndex]) return null;

    try {
      const result = await trpc.recipe.extractFromPhotos.mutate({
        images: extractedImageGroups[groupIndex],
      });
      return result;
    } catch (err: any) {
      error = err.message || 'Failed to retry extraction';
      return null;
    }
  }

  async function handleSaveBulkRecipes(recipes: any[]) {
    saving = true;
    error = '';

    try {
      await trpc.recipe.bulkCreate.mutate({ recipes });
      clearDraft();
      goto('/');
    } catch (err: any) {
      error = err.message || 'Failed to save recipes';
      saving = false;
    }
  }

  function handlePhotoBack() {
    error = '';
    if (photoStep === 'group') {
      photoStep = 'upload';
    } else if (photoStep === 'review') {
      photoStep = 'group';
    }
  }

  function resetPhotoImport() {
    photoStep = 'upload';
    photos = [];
    photoGroups = [];
    extractedRecipes = [];
    extractedImageGroups = [];
    error = '';
    clearDraft();
  }

  function handleModeChange(newMode: ImportMode) {
    mode = newMode;
    error = '';
    if (newMode === 'photos') {
      resetPhotoImport();
    }
  }
</script>

<Header />

<main>
  <div class="container">
    <h2>Import Recipe</h2>

    {#if hasDraft && mode !== 'photos'}
      <div class="draft-banner">
        <div class="draft-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <div>
            <strong>You have an unsaved photo import</strong>
            {#if draftSavedAt}
              <span class="draft-time">
                Saved {draftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            {/if}
          </div>
        </div>
        <div class="draft-actions">
          <button type="button" class="btn-restore" onclick={restoreDraft}>
            Continue
          </button>
          <button type="button" class="btn-discard" onclick={clearDraft}>
            Discard
          </button>
        </div>
      </div>
    {/if}

    {#if mode === 'preview' && fetchedRecipe}
      <div class="info">
        <p>✅ Recipe fetched successfully! Review and edit the details below, then save.</p>
      </div>
      <RecipeForm recipe={fetchedRecipe} onSubmit={handleSaveRecipe} onCancel={handleCancel} />
    {:else}
      <div class="mode-toggle">
        <button
          class:active={mode === 'url'}
          onclick={() => handleModeChange('url')}
        >
          From Website
        </button>
        {#if hasPhotoExtraction}
          <button
            class:active={mode === 'photos'}
            onclick={() => handleModeChange('photos')}
          >
            From Photo
          </button>
        {/if}
        {#if hasJsonldImport}
          <button
            class:active={mode === 'jsonld'}
            onclick={() => handleModeChange('jsonld')}
          >
            From Code
          </button>
        {/if}
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
      {:else if mode === 'photos'}
        {#if photoStep === 'upload'}
          <div class="info photo-info">
            <div class="info-icon">📸</div>
            <div>
              <p><strong>Take a photo of any recipe to add it to your collection</strong></p>
              <p class="info-secondary">Works with cookbooks, recipe cards, handwritten notes, or magazine clippings.</p>
            </div>
          </div>

          <PhotoUploader bind:images={photos} maxImages={20} {compressionLevel} />

          <div class="photo-actions">
            {#if photos.length === 1}
              <button
                type="button"
                class="btn-primary btn-large"
                onclick={handlePhotosNext}
              >
                <span class="btn-icon">✨</span>
                Import Recipe
              </button>
            {:else if photos.length > 1}
              <button
                type="button"
                class="btn-primary"
                onclick={handleQuickExtract}
              >
                <span class="btn-icon">✨</span>
                Import as One Recipe
              </button>
              <button
                type="button"
                class="btn-secondary"
                onclick={handlePhotosNext}
              >
                Multiple Recipes...
              </button>
            {:else}
              <button
                type="button"
                class="btn-primary btn-large"
                disabled
              >
                Upload a photo to get started
              </button>
            {/if}
          </div>

          <details class="advanced-options">
            <summary>Advanced Options</summary>
            <div class="options-content">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={economyMode} />
                <span class="toggle-text">
                  <strong>Economy Mode</strong>
                  <span class="toggle-hint">Uses higher image compression to reduce costs</span>
                </span>
              </label>
            </div>
          </details>
        {:else if photoStep === 'group'}
          <PhotoGrouper
            images={photos}
            bind:groups={photoGroups}
            onExtract={handleExtractRecipes}
            disabled={extracting}
          />

          <div class="back-link">
            <button type="button" class="btn-link" onclick={handlePhotoBack}>
              Back to Upload
            </button>
          </div>
        {:else if photoStep === 'extract'}
          <div class="extracting-state">
            <div class="spinner-large"></div>
            <h3>Extracting Recipes...</h3>
            <p>Analyzing your photos with AI. This may take a moment.</p>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {(extractionProgress.current / extractionProgress.total) * 100}%"></div>
            </div>
            <p class="progress-text">
              {extractionProgress.current} of {extractionProgress.total} recipes processed
            </p>
          </div>
        {:else if photoStep === 'review'}
          <BulkRecipeReview
            recipes={extractedRecipes}
            imageGroups={extractedImageGroups}
            onSave={handleSaveBulkRecipes}
            onBack={handlePhotoBack}
            onRetry={handleRetryExtraction}
            {saving}
          />
        {/if}
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

  .info.photo-info {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    background: linear-gradient(135deg, #e8f4ff 0%, #f0f7ff 100%);
  }

  .info-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .info-secondary {
    color: var(--color-text-light);
    font-size: 0.9375rem;
  }

  .info p {
    margin: 0 0 0.5rem;
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

  /* Photo import styles */
  .photo-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
    flex-wrap: wrap;
  }

  .btn-large {
    padding: 1rem 2rem;
    font-size: 1.125rem;
  }

  .btn-icon {
    margin-right: 0.5rem;
  }

  .advanced-options {
    margin-top: 2rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-subtle);
  }

  .advanced-options summary {
    padding: 1rem 1.25rem;
    cursor: pointer;
    font-weight: 500;
    color: var(--color-text-light);
    user-select: none;
  }

  .advanced-options summary:hover {
    color: var(--color-text);
  }

  .advanced-options[open] summary {
    border-bottom: 1px solid var(--color-border);
  }

  .options-content {
    padding: 1.25rem;
  }

  /* Draft banner styles */
  .draft-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
  }

  .draft-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    color: #0369a1;
  }

  .draft-info svg {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .draft-time {
    display: block;
    font-size: var(--text-sm);
    color: #0284c7;
    font-weight: normal;
  }

  .draft-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .btn-restore {
    padding: var(--spacing-2) var(--spacing-4);
    background: #0284c7;
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-restore:hover {
    background: #0369a1;
  }

  .btn-discard {
    padding: var(--spacing-2) var(--spacing-4);
    background: transparent;
    color: #64748b;
    border: 1px solid #cbd5e1;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-discard:hover {
    background: #f1f5f9;
  }

  /* Economy mode toggle */
  .economy-toggle {
    margin-bottom: var(--spacing-4);
  }

  .toggle-label {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .toggle-label:hover {
    border-color: var(--color-primary-light);
  }

  .toggle-label:has(input:checked) {
    border-color: var(--color-primary);
    background: rgba(255, 107, 53, 0.03);
  }

  .toggle-label input {
    margin-top: 2px;
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .toggle-hint {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    font-weight: normal;
  }

  /* Photo import styles */
  .back-link {
    margin-top: var(--spacing-4);
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--color-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    padding: 0;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .extracting-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-12) var(--spacing-4);
    text-align: center;
  }

  .spinner-large {
    width: 48px;
    height: 48px;
    border: 4px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-6);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .extracting-state h3 {
    margin: 0 0 var(--spacing-2) 0;
    color: var(--color-text);
  }

  .extracting-state p {
    margin: 0;
    color: var(--color-text-light);
  }

  .progress-bar {
    width: 100%;
    max-width: 300px;
    height: 8px;
    background: var(--color-border);
    border-radius: 4px;
    margin-top: var(--spacing-6);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.3s ease;
    border-radius: 4px;
  }

  .progress-text {
    margin-top: var(--spacing-2) !important;
    font-size: var(--text-sm);
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
