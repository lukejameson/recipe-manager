<script lang="ts">
  import AIBadge from './AIBadge.svelte';
  import AIButton from './AIButton.svelte';
  import { trpc } from '$lib/trpc/client';

  interface ImprovementSuggestion {
    category: string;
    suggestion: string;
    explanation: string;
    priority: 'high' | 'medium' | 'low';
  }

  interface AppliedRecipe {
    title: string;
    ingredients: string[];
    instructions: string[];
    changes: string[];
  }

  interface Props {
    recipe: {
      id: string;
      title: string;
      description?: string;
      ingredients: string[];
      instructions: string[];
      prepTime?: number;
      cookTime?: number;
    };
    savedIdeas?: ImprovementSuggestion[];
    onClose: () => void;
    onSave?: (ideas: ImprovementSuggestion[]) => void;
    onApply?: (recipe: { title: string; ingredients: string[]; instructions: string[] }) => void;
  }

  let { recipe, savedIdeas, onClose, onSave, onApply }: Props = $props();

  let loading = $state(!savedIdeas || savedIdeas.length === 0);
  let error = $state('');
  let suggestions = $state<ImprovementSuggestion[]>(savedIdeas || []);
  let saving = $state(false);
  let saved = $state(!!savedIdeas && savedIdeas.length > 0);

  // Selection state
  let selectedIndexes = $state<Set<number>>(new Set());
  let applying = $state(false);
  let appliedRecipe = $state<AppliedRecipe | null>(null);
  let showPreview = $state(false);

  const categoryIcons: Record<string, string> = {
    flavor: '🧂',
    technique: '👨‍🍳',
    presentation: '🍽️',
    efficiency: '⏱️',
  };

  const priorityLabels: Record<string, string> = {
    high: 'High impact',
    medium: 'Medium impact',
    low: 'Nice to have',
  };

  $effect(() => {
    if (!savedIdeas || savedIdeas.length === 0) {
      loadSuggestions();
    }
  });

  async function loadSuggestions() {
    loading = true;
    error = '';
    saved = false;

    try {
      const result = await trpc.ai.suggestImprovements.mutate({ recipe });
      suggestions = result;
    } catch (err: any) {
      error = err.message || 'Failed to get suggestions';
    } finally {
      loading = false;
    }
  }

  async function handleSave() {
    if (suggestions.length === 0) return;

    saving = true;
    try {
      await trpc.recipe.saveImprovementIdeas.mutate({
        id: recipe.id,
        improvementIdeas: suggestions,
      });
      saved = true;
      onSave?.(suggestions);
    } catch (err: any) {
      error = err.message || 'Failed to save suggestions';
    } finally {
      saving = false;
    }
  }

  function handleRegenerate() {
    saved = false;
    selectedIndexes = new Set();
    appliedRecipe = null;
    showPreview = false;
    loadSuggestions();
  }

  function toggleSelection(index: number) {
    const newSet = new Set(selectedIndexes);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    selectedIndexes = newSet;
  }

  function selectAll() {
    selectedIndexes = new Set(suggestions.map((_, i) => i));
  }

  function deselectAll() {
    selectedIndexes = new Set();
  }

  const selectedCount = $derived(selectedIndexes.size);

  async function handleApplyImprovements() {
    if (selectedIndexes.size === 0) return;

    const selectedSuggestions = Array.from(selectedIndexes).map(i => suggestions[i]);

    applying = true;
    error = '';

    try {
      const result = await trpc.ai.applyImprovements.mutate({
        recipe: {
          title: recipe.title,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
        },
        improvements: selectedSuggestions.map(s => s.suggestion),
      });
      appliedRecipe = result;
      showPreview = true;
    } catch (err: any) {
      error = err.message || 'Failed to apply improvements';
    } finally {
      applying = false;
    }
  }

  function handleConfirmApply() {
    if (appliedRecipe && onApply) {
      onApply({
        title: appliedRecipe.title,
        ingredients: appliedRecipe.ingredients,
        instructions: appliedRecipe.instructions,
      });
    }
    onClose();
  }

  function handleBackToSuggestions() {
    showPreview = false;
    appliedRecipe = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showPreview) {
        handleBackToSuggestions();
      } else {
        onClose();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div>
        <h3>Improvement Ideas</h3>
        <p class="recipe-name">{recipe.title}</p>
      </div>
      <button class="btn-close" onclick={onClose}>&times;</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Analyzing recipe...</p>
        </div>
      {:else if applying}
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Applying improvements...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <AIButton onclick={loadSuggestions} label="Try Again" variant="subtle" />
        </div>
      {:else if showPreview && appliedRecipe}
        <!-- Preview of applied improvements -->
        <div class="preview-section">
          <div class="preview-header">
            <h4>Preview Changes</h4>
            <p class="preview-subtitle">Review the improved recipe before applying</p>
          </div>

          {#if appliedRecipe.changes.length > 0}
            <div class="changes-summary">
              <h5>Changes Made:</h5>
              <ul>
                {#each appliedRecipe.changes as change}
                  <li>{change}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <div class="preview-content">
            <div class="preview-block">
              <h5>Ingredients</h5>
              <ul class="preview-list">
                {#each appliedRecipe.ingredients as ingredient}
                  <li>{ingredient}</li>
                {/each}
              </ul>
            </div>

            <div class="preview-block">
              <h5>Instructions</h5>
              <ol class="preview-list">
                {#each appliedRecipe.instructions as instruction}
                  <li>{instruction}</li>
                {/each}
              </ol>
            </div>
          </div>
        </div>
      {:else if suggestions.length === 0}
        <div class="empty-state">
          <p>This recipe looks great as is!</p>
        </div>
      {:else}
        <!-- Selection toolbar -->
        <div class="selection-toolbar">
          <span class="selection-count">
            {selectedCount} of {suggestions.length} selected
          </span>
          <div class="selection-actions">
            <button class="btn-link" onclick={selectAll}>Select all</button>
            <button class="btn-link" onclick={deselectAll}>Clear</button>
          </div>
        </div>

        <div class="suggestions-list">
          {#each suggestions as suggestion, index}
            <label class="suggestion-card {suggestion.priority}" class:selected={selectedIndexes.has(index)}>
              <input
                type="checkbox"
                checked={selectedIndexes.has(index)}
                onchange={() => toggleSelection(index)}
                class="suggestion-checkbox"
              />
              <div class="suggestion-content">
                <div class="suggestion-header">
                  <span class="category">
                    <span class="icon">{categoryIcons[suggestion.category] || '💡'}</span>
                    {suggestion.category}
                  </span>
                  <span class="priority">{priorityLabels[suggestion.priority]}</span>
                </div>
                <p class="suggestion-text">{suggestion.suggestion}</p>
                <p class="explanation">{suggestion.explanation}</p>
              </div>
            </label>
          {/each}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <AIBadge />
      <div class="footer-actions">
        {#if showPreview && appliedRecipe}
          <button class="btn-secondary" onclick={handleBackToSuggestions}>
            Back
          </button>
          <button class="btn-apply" onclick={handleConfirmApply}>
            Apply to Recipe
          </button>
        {:else if suggestions.length > 0 && !loading && !applying}
          <button class="btn-regenerate" onclick={handleRegenerate} disabled={saving}>
            Regenerate
          </button>
          {#if saved}
            <span class="saved-indicator">Saved</span>
          {:else}
            <button class="btn-save" onclick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Ideas'}
            </button>
          {/if}
          <button
            class="btn-apply"
            onclick={handleApplyImprovements}
            disabled={selectedCount === 0}
          >
            Apply Selected ({selectedCount})
          </button>
        {/if}
        <button class="btn-secondary" onclick={onClose}>Close</button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-4);
  }

  .modal {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 560px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--spacing-4) var(--spacing-5);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .recipe-name {
    margin: var(--spacing-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: var(--text-xl);
    color: var(--color-text-light);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
  }

  .btn-close:hover {
    color: var(--color-text);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4) var(--spacing-5);
  }

  .loading-state,
  .error-state,
  .empty-state {
    text-align: center;
    padding: var(--spacing-6);
    color: var(--color-text-light);
  }

  .loading-state .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto var(--spacing-3);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state {
    color: var(--color-error);
  }

  .selection-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-background);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-3);
  }

  .selection-count {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .selection-actions {
    display: flex;
    gap: var(--spacing-3);
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

  .suggestions-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .suggestion-card {
    display: flex;
    gap: var(--spacing-3);
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    border-left: 3px solid var(--color-border);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .suggestion-card:hover {
    background: var(--color-surface);
  }

  .suggestion-card.selected {
    background: rgba(74, 158, 255, 0.08);
    border-left-color: var(--color-primary);
  }

  .suggestion-checkbox {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  .suggestion-content {
    flex: 1;
    min-width: 0;
  }

  .suggestion-card.high:not(.selected) {
    border-left-color: var(--color-success);
  }

  .suggestion-card.medium:not(.selected) {
    border-left-color: var(--color-warning);
  }

  .suggestion-card.low:not(.selected) {
    border-left-color: var(--color-border);
  }

  .suggestion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2);
  }

  .category {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--text-sm);
    font-weight: 500;
    text-transform: capitalize;
    color: var(--color-text-light);
  }

  .icon {
    font-size: var(--text-base);
  }

  .priority {
    font-size: var(--text-xs);
    color: var(--color-text-lighter);
    background: var(--color-surface);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-full);
  }

  .suggestion-text {
    margin: 0 0 var(--spacing-2);
    font-weight: 500;
    line-height: 1.5;
  }

  .explanation {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3) var(--spacing-5);
    border-top: 1px solid var(--color-border);
  }

  .footer-actions {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
  }

  .btn-secondary {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-secondary:hover {
    background: var(--color-surface);
  }

  .btn-save {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-save:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-regenerate {
    padding: var(--spacing-2) var(--spacing-4);
    background: transparent;
    color: var(--color-text-light);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-regenerate:hover:not(:disabled) {
    background: var(--color-background);
    color: var(--color-text);
  }

  .btn-regenerate:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .saved-indicator {
    padding: var(--spacing-2) var(--spacing-4);
    color: var(--color-success);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }

  .saved-indicator::before {
    content: '✓';
  }

  .btn-apply {
    padding: var(--spacing-2) var(--spacing-4);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-apply:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-apply:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Preview styles */
  .preview-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .preview-header h4 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .preview-subtitle {
    margin: var(--spacing-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .changes-summary {
    background: rgba(74, 158, 255, 0.08);
    border: 1px solid rgba(74, 158, 255, 0.2);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
  }

  .changes-summary h5 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-primary);
  }

  .changes-summary ul {
    margin: 0;
    padding-left: var(--spacing-5);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .changes-summary li {
    margin-bottom: var(--spacing-1);
  }

  .preview-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .preview-block {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
  }

  .preview-block h5 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text);
    padding-bottom: var(--spacing-2);
    border-bottom: 1px solid var(--color-border);
  }

  .preview-list {
    margin: 0;
    padding-left: var(--spacing-5);
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .preview-list li {
    margin-bottom: var(--spacing-2);
  }
</style>
