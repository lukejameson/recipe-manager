<script lang="ts">
  import { onMount } from 'svelte';
  import { trpc } from '$lib/trpc/client';
  import RecipeForm from './RecipeForm.svelte';

  interface ExtractedRecipe {
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
    confidence: number;
    extractionNotes?: string;
  }

  let {
    recipes,
    imageGroups,
    onSave,
    onBack,
    onRetry,
    saving = false,
  }: {
    recipes: ExtractedRecipe[];
    imageGroups: string[][];
    onSave: (recipes: any[]) => Promise<void>;
    onBack: () => void;
    onRetry?: (groupIndex: number) => Promise<ExtractedRecipe | null>;
    saving?: boolean;
  } = $props();

  let selectedIndices = $state<Set<number>>(new Set(recipes.map((_, i) => i)));
  let expandedIndex = $state<number | null>(recipes.length === 1 ? 0 : null);
  let editedRecipes = $state<any[]>(recipes.map(convertToFormData));
  let retryingIndex = $state<number | null>(null);

  // Duplicate detection
  let existingRecipes = $state<Array<{ id: string; title: string }>>([]);
  let duplicateWarnings = $state<Map<number, string[]>>(new Map());

  onMount(async () => {
    // Load existing recipe titles for duplicate detection
    try {
      const allRecipes = await trpc.recipe.list.query({});
      existingRecipes = allRecipes.map((r: any) => ({ id: r.id, title: r.title }));
      checkForDuplicates();
    } catch (err) {
      // Ignore errors - duplicate detection is optional
    }
  });

  function checkForDuplicates() {
    const warnings = new Map<number, string[]>();

    editedRecipes.forEach((recipe, index) => {
      const matches: string[] = [];
      const recipeTitle = recipe.title.toLowerCase().trim();

      for (const existing of existingRecipes) {
        const existingTitle = existing.title.toLowerCase().trim();

        // Exact match
        if (recipeTitle === existingTitle) {
          matches.push(`Exact match: "${existing.title}"`);
          continue;
        }

        // Similar match (one contains the other or high similarity)
        if (
          recipeTitle.length > 5 &&
          (existingTitle.includes(recipeTitle) || recipeTitle.includes(existingTitle))
        ) {
          matches.push(`Similar: "${existing.title}"`);
        }
      }

      if (matches.length > 0) {
        warnings.set(index, matches);
      }
    });

    duplicateWarnings = warnings;
  }

  // Re-check duplicates when recipes change
  $effect(() => {
    if (editedRecipes.length > 0 && existingRecipes.length > 0) {
      checkForDuplicates();
    }
  });

  function convertToFormData(recipe: ExtractedRecipe) {
    return {
      title: recipe.title,
      description: recipe.description || '',
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      tags: recipe.tags.map((t) => ({ name: t })),
      difficulty: recipe.difficulty,
      confidence: recipe.confidence,
      extractionNotes: recipe.extractionNotes,
      failed: recipe.confidence === 0 && recipe.ingredients.length === 0,
    };
  }

  function toggleSelect(index: number) {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    selectedIndices = newSet;
  }

  function selectAll() {
    selectedIndices = new Set(recipes.map((_, i) => i));
  }

  function deselectAll() {
    selectedIndices = new Set();
  }

  function toggleExpand(index: number) {
    expandedIndex = expandedIndex === index ? null : index;
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.5) return '#f59e0b';
    return '#ef4444';
  }

  function getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  }

  async function handleFormSubmit(index: number, data: any) {
    editedRecipes[index] = {
      ...data,
      tags: data.tags.map((t: any) => ({ name: typeof t === 'string' ? t : t.name })),
      confidence: editedRecipes[index].confidence,
      extractionNotes: editedRecipes[index].extractionNotes,
      failed: false,
    };
    expandedIndex = null;
  }

  async function handleRetry(index: number) {
    if (!onRetry) return;

    retryingIndex = index;
    try {
      const newRecipe = await onRetry(index);
      if (newRecipe) {
        editedRecipes[index] = convertToFormData(newRecipe);
        // Update the original recipes array reference
        recipes[index] = newRecipe;
      }
    } finally {
      retryingIndex = null;
    }
  }

  function formatExtractionNotes(recipe: any, originalRecipe: ExtractedRecipe): string {
    const lines: string[] = [];
    const now = new Date().toLocaleDateString();

    lines.push(`📷 Imported from photo on ${now}`);
    lines.push(`Extraction confidence: ${Math.round(originalRecipe.confidence * 100)}%`);

    if (originalRecipe.extractionNotes) {
      lines.push('');
      lines.push('AI notes:');
      lines.push(originalRecipe.extractionNotes);
    }

    return lines.join('\n');
  }

  async function handleSaveSelected() {
    const toSave = Array.from(selectedIndices)
      .filter((i) => !editedRecipes[i].failed)
      .map((i) => {
        const recipe = editedRecipes[i];
        const originalRecipe = recipes[i];

        // Format notes with extraction metadata
        const extractionNote = formatExtractionNotes(recipe, originalRecipe);

        return {
          title: recipe.title,
          description: recipe.description || undefined,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          totalTime: recipe.totalTime,
          servings: recipe.servings,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          tags: recipe.tags.map((t: any) => (typeof t === 'string' ? t : t.name)),
          notes: extractionNote,
        };
      });

    await onSave(toSave);
  }

  const selectedCount = $derived(
    Array.from(selectedIndices).filter((i) => !editedRecipes[i]?.failed).length
  );
  const failedCount = $derived(editedRecipes.filter((r) => r.failed).length);
</script>

<div class="bulk-review">
  <div class="review-header">
    <div class="header-info">
      <h3>Review Extracted Recipes</h3>
      <p class="hint">
        Review and edit the extracted recipes before saving. Click on a recipe to edit its details.
      </p>
      {#if failedCount > 0}
        <p class="failed-hint">
          {failedCount} recipe{failedCount > 1 ? 's' : ''} failed to extract. You can retry or remove them.
        </p>
      {/if}
    </div>
    <div class="selection-controls">
      <button type="button" class="btn-link" onclick={selectAll}>Select All</button>
      <span class="divider">|</span>
      <button type="button" class="btn-link" onclick={deselectAll}>Deselect All</button>
    </div>
  </div>

  <div class="recipes-list">
    {#each editedRecipes as recipe, index}
      {@const isFailed = recipe.failed}
      {@const duplicates = duplicateWarnings.get(index)}
      <div
        class="recipe-card"
        class:selected={selectedIndices.has(index)}
        class:expanded={expandedIndex === index}
        class:failed={isFailed}
      >
        <div class="recipe-header" onclick={() => !isFailed && expandedIndex !== index && toggleExpand(index)}>
          <label class="checkbox-label" onclick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedIndices.has(index)}
              onchange={() => toggleSelect(index)}
              disabled={isFailed}
            />
          </label>

          <div class="recipe-info">
            <h4 class:failed-title={isFailed}>
              {isFailed ? `Failed Recipe ${index + 1}` : recipe.title}
            </h4>
            {#if !isFailed}
              <div class="recipe-meta">
                {#if recipe.servings}
                  <span>{recipe.servings} servings</span>
                {/if}
                {#if recipe.totalTime}
                  <span>{recipe.totalTime} min</span>
                {/if}
                <span>{recipe.ingredients.length} ingredients</span>
              </div>
            {:else}
              <div class="recipe-meta failed-meta">
                <span>Extraction failed - try again or remove</span>
              </div>
            {/if}
          </div>

          {#if !isFailed}
            <div class="confidence-badge" style="--confidence-color: {getConfidenceColor(recipes[index].confidence)}">
              <span class="confidence-label">{getConfidenceLabel(recipes[index].confidence)}</span>
              <span class="confidence-value">{Math.round(recipes[index].confidence * 100)}%</span>
            </div>
          {/if}

          {#if isFailed && onRetry}
            <button
              type="button"
              class="btn-retry"
              onclick={(e) => { e.stopPropagation(); handleRetry(index); }}
              disabled={retryingIndex !== null}
            >
              {#if retryingIndex === index}
                <span class="spinner"></span>
                Retrying...
              {:else}
                Retry
              {/if}
            </button>
          {/if}

          {#if !isFailed}
            <button
              type="button"
              class="btn-expand"
              onclick={(e) => { e.stopPropagation(); toggleExpand(index); }}
            >
              {expandedIndex === index ? 'Collapse' : 'Edit'}
            </button>
          {/if}
        </div>

        {#if duplicates && duplicates.length > 0 && expandedIndex !== index}
          <div class="duplicate-warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              <strong>Possible duplicate:</strong>
              {duplicates.slice(0, 2).join(', ')}
              {#if duplicates.length > 2}
                <span class="more">+{duplicates.length - 2} more</span>
              {/if}
            </span>
          </div>
        {/if}

        {#if recipes[index].extractionNotes && expandedIndex !== index && !isFailed}
          <div class="extraction-notes">
            <strong>Note:</strong> {recipes[index].extractionNotes}
          </div>
        {/if}

        {#if expandedIndex === index && !isFailed}
          <div class="recipe-form-container">
            {#if duplicates && duplicates.length > 0}
              <div class="duplicate-warning-expanded">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>
                  <strong>Possible duplicates found:</strong>
                  <ul>
                    {#each duplicates as dup}
                      <li>{dup}</li>
                    {/each}
                  </ul>
                </div>
              </div>
            {/if}
            <RecipeForm
              recipe={recipe}
              onSubmit={(data) => handleFormSubmit(index, data)}
              onCancel={() => toggleExpand(index)}
            />
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="review-actions">
    <button type="button" class="btn-back" onclick={onBack} disabled={saving || retryingIndex !== null}>
      Back to Photos
    </button>
    <button
      type="button"
      class="btn-save"
      onclick={handleSaveSelected}
      disabled={selectedCount === 0 || saving || retryingIndex !== null}
    >
      {#if saving}
        Saving...
      {:else}
        Save {selectedCount} {selectedCount === 1 ? 'Recipe' : 'Recipes'}
      {/if}
    </button>
  </div>
</div>

<style>
  .bulk-review {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-4);
    flex-wrap: wrap;
  }

  .header-info h3 {
    margin: 0 0 var(--spacing-1) 0;
    font-size: var(--text-lg);
    color: var(--color-text);
  }

  .hint {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .failed-hint {
    margin: var(--spacing-2) 0 0 0;
    font-size: var(--text-sm);
    color: var(--color-error);
  }

  .selection-controls {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
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

  .divider {
    color: var(--color-border);
  }

  .recipes-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .recipe-card {
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: var(--transition-fast);
    background: var(--color-surface);
  }

  .recipe-card.selected {
    border-color: var(--color-primary-light);
    background: rgba(255, 107, 53, 0.02);
  }

  .recipe-card.expanded {
    border-color: var(--color-primary);
  }

  .recipe-card.failed {
    border-color: #fecaca;
    background: #fef2f2;
  }

  .recipe-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .recipe-header:hover {
    background: var(--color-bg-subtle);
  }

  .recipe-card.failed .recipe-header:hover {
    background: #fee2e2;
  }

  .checkbox-label {
    cursor: pointer;
  }

  .checkbox-label input {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }

  .checkbox-label input:disabled {
    cursor: not-allowed;
  }

  .recipe-info {
    flex: 1;
    min-width: 0;
  }

  .recipe-info h4 {
    margin: 0 0 var(--spacing-1) 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recipe-info h4.failed-title {
    color: var(--color-error);
  }

  .recipe-meta {
    display: flex;
    gap: var(--spacing-3);
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .recipe-meta.failed-meta {
    color: var(--color-error);
  }

  .recipe-meta span {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }

  .confidence-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    border: 1px solid var(--confidence-color);
  }

  .confidence-label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--confidence-color);
    text-transform: uppercase;
  }

  .confidence-value {
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    color: var(--confidence-color);
  }

  .btn-retry {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-4);
    background: white;
    border: 2px solid var(--color-error);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-error);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-retry:hover:not(:disabled) {
    background: #fef2f2;
  }

  .btn-retry:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid #fecaca;
    border-top-color: var(--color-error);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .btn-expand {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
  }

  .btn-expand:hover {
    background: var(--color-border-light);
  }

  .duplicate-warning {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    background: #fffbeb;
    border-top: 1px solid #fef3c7;
    font-size: var(--text-sm);
    color: #92400e;
  }

  .duplicate-warning svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: #f59e0b;
  }

  .duplicate-warning .more {
    color: #b45309;
    font-style: italic;
  }

  .duplicate-warning-expanded {
    display: flex;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-4);
    font-size: var(--text-sm);
    color: #92400e;
  }

  .duplicate-warning-expanded svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: #f59e0b;
    margin-top: 2px;
  }

  .duplicate-warning-expanded ul {
    margin: var(--spacing-1) 0 0 0;
    padding-left: var(--spacing-4);
  }

  .duplicate-warning-expanded li {
    margin-bottom: var(--spacing-1);
  }

  .extraction-notes {
    padding: var(--spacing-3) var(--spacing-4);
    background: #f0f9ff;
    border-top: 1px solid #bae6fd;
    font-size: var(--text-sm);
    color: #0369a1;
  }

  .recipe-form-container {
    padding: var(--spacing-4);
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-subtle);
  }

  .review-actions {
    display: flex;
    gap: var(--spacing-4);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-border);
  }

  .btn-back,
  .btn-save {
    padding: var(--spacing-3) var(--spacing-5);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-back {
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border: 2px solid var(--color-border);
  }

  .btn-back:hover:not(:disabled) {
    background: var(--color-bg-subtle);
  }

  .btn-save {
    flex: 1;
    background: var(--color-primary);
    color: white;
    border: 2px solid var(--color-primary);
  }

  .btn-save:hover:not(:disabled) {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .btn-back:disabled,
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 640px) {
    .review-header {
      flex-direction: column;
    }

    .recipe-header {
      flex-wrap: wrap;
    }

    .confidence-badge {
      order: 1;
      margin-left: auto;
    }

    .btn-expand,
    .btn-retry {
      order: 2;
      width: 100%;
      margin-top: var(--spacing-2);
      justify-content: center;
    }

    .recipe-meta {
      flex-wrap: wrap;
    }

    .review-actions {
      flex-direction: column;
    }
  }
</style>
