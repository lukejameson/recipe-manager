<script lang="ts">
  import AIBadge from './AIBadge.svelte';
  import AIButton from './AIButton.svelte';
  import { trpc } from '$lib/trpc/client';

  type AdaptationType =
    | 'vegan'
    | 'vegetarian'
    | 'gluten-free'
    | 'dairy-free'
    | 'low-carb'
    | 'keto'
    | 'nut-free'
    | 'low-sodium';

  interface AdaptationChange {
    original: string;
    replacement: string;
    reason: string;
  }

  interface AdaptedRecipe {
    title: string;
    ingredients: string[];
    instructions: string[];
    changes: AdaptationChange[];
    warnings: string[];
  }

  interface Props {
    recipe: {
      id: string;
      title: string;
      ingredients: string[];
      instructions: string[];
    };
    onClose: () => void;
    onSaveAsCopy: (adapted: AdaptedRecipe) => void;
    onUpdateOriginal: (adapted: AdaptedRecipe) => void;
  }

  let { recipe, onClose, onSaveAsCopy, onUpdateOriginal }: Props = $props();

  let selectedType = $state<AdaptationType | null>(null);
  let loading = $state(false);
  let error = $state('');
  let adaptedRecipe = $state<AdaptedRecipe | null>(null);

  const adaptationTypes: { value: AdaptationType; label: string; emoji: string }[] = [
    { value: 'vegan', label: 'Vegan', emoji: '🌱' },
    { value: 'vegetarian', label: 'Vegetarian', emoji: '🥗' },
    { value: 'gluten-free', label: 'Gluten-Free', emoji: '🌾' },
    { value: 'dairy-free', label: 'Dairy-Free', emoji: '🥛' },
    { value: 'low-carb', label: 'Low Carb', emoji: '🥩' },
    { value: 'keto', label: 'Keto', emoji: '🥑' },
    { value: 'nut-free', label: 'Nut-Free', emoji: '🥜' },
    { value: 'low-sodium', label: 'Low Sodium', emoji: '🧂' },
  ];

  async function handleAdapt() {
    if (!selectedType) return;

    loading = true;
    error = '';
    adaptedRecipe = null;

    try {
      const result = await trpc.ai.adaptRecipe.mutate({
        recipe: {
          title: recipe.title,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
        },
        adaptationType: selectedType,
      });
      adaptedRecipe = result;
    } catch (err: any) {
      error = err.message || 'Failed to adapt recipe';
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div>
        <h3>Adapt Recipe</h3>
        <p class="recipe-name">{recipe.title}</p>
      </div>
      <button class="btn-close" onclick={onClose}>&times;</button>
    </div>

    <div class="modal-body">
      {#if !adaptedRecipe}
        <div class="type-selection">
          <p class="selection-label">Select dietary requirement:</p>
          <div class="type-grid">
            {#each adaptationTypes as type}
              <button
                class="type-btn"
                class:selected={selectedType === type.value}
                onclick={() => (selectedType = type.value)}
                disabled={loading}
              >
                <span class="emoji">{type.emoji}</span>
                <span class="label">{type.label}</span>
              </button>
            {/each}
          </div>

          {#if error}
            <p class="error">{error}</p>
          {/if}

          <div class="action-row">
            <AIButton
              onclick={handleAdapt}
              {loading}
              disabled={!selectedType}
              label="Adapt Recipe"
              loadingLabel="Adapting..."
              variant="primary"
            />
          </div>
        </div>
      {:else}
        <div class="adapted-preview">
          {#if adaptedRecipe.warnings.length > 0}
            <div class="warnings">
              {#each adaptedRecipe.warnings as warning}
                <p class="warning">⚠️ {warning}</p>
              {/each}
            </div>
          {/if}

          {#if adaptedRecipe.changes.length > 0}
            <div class="changes-section">
              <h4>Changes Made</h4>
              <div class="changes-list">
                {#each adaptedRecipe.changes as change}
                  <div class="change-item">
                    <div class="change-arrow">
                      <span class="original">{change.original}</span>
                      <span class="arrow">→</span>
                      <span class="replacement">{change.replacement}</span>
                    </div>
                    <p class="change-reason">{change.reason}</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <details class="preview-details">
            <summary>Preview adapted ingredients ({adaptedRecipe.ingredients.length})</summary>
            <ul class="ingredient-preview">
              {#each adaptedRecipe.ingredients as ing}
                <li>{ing}</li>
              {/each}
            </ul>
          </details>

          <div class="save-actions">
            <button class="btn-secondary" onclick={() => (adaptedRecipe = null)}>
              ← Try Different
            </button>
            <button class="btn-primary" onclick={() => onSaveAsCopy(adaptedRecipe!)}>
              Save as Copy
            </button>
            <button class="btn-warning" onclick={() => onUpdateOriginal(adaptedRecipe!)}>
              Update Original
            </button>
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <AIBadge />
      <button class="btn-secondary" onclick={onClose}>Cancel</button>
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

  .selection-label {
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-2);
  }

  @media (min-width: 480px) {
    .type-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .type-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: var(--spacing-3);
    background: var(--color-background);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .type-btn:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: rgba(255, 107, 53, 0.05);
  }

  .type-btn.selected {
    border-color: var(--color-primary);
    background: rgba(255, 107, 53, 0.1);
  }

  .type-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .type-btn .emoji {
    font-size: var(--text-xl);
  }

  .type-btn .label {
    font-size: var(--text-xs);
    font-weight: 500;
  }

  .error {
    color: var(--color-error);
    font-size: var(--text-sm);
    margin: var(--spacing-3) 0;
  }

  .action-row {
    margin-top: var(--spacing-4);
    display: flex;
    justify-content: center;
  }

  .adapted-preview {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .warnings {
    background: rgba(245, 158, 11, 0.1);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
  }

  .warning {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-warning);
  }

  .warning + .warning {
    margin-top: var(--spacing-2);
  }

  .changes-section h4 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .changes-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .change-item {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
  }

  .change-arrow {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    flex-wrap: wrap;
    font-size: var(--text-sm);
  }

  .original {
    text-decoration: line-through;
    color: var(--color-text-light);
  }

  .arrow {
    color: var(--color-primary);
  }

  .replacement {
    font-weight: 500;
    color: var(--color-success);
  }

  .change-reason {
    margin: var(--spacing-2) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-light);
  }

  .preview-details {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
  }

  .preview-details summary {
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .ingredient-preview {
    margin: var(--spacing-3) 0 0;
    padding-left: var(--spacing-5);
    font-size: var(--text-sm);
  }

  .ingredient-preview li {
    margin-bottom: var(--spacing-1);
  }

  .save-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    justify-content: center;
  }

  .btn-secondary,
  .btn-primary,
  .btn-warning {
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    font-size: var(--text-sm);
  }

  .btn-secondary {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    color: var(--color-text);
  }

  .btn-secondary:hover {
    background: var(--color-surface);
  }

  .btn-primary {
    background: var(--color-primary);
    border: 1px solid var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-dark);
  }

  .btn-warning {
    background: transparent;
    border: 1px solid var(--color-warning);
    color: var(--color-warning);
  }

  .btn-warning:hover {
    background: rgba(245, 158, 11, 0.1);
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3) var(--spacing-5);
    border-top: 1px solid var(--color-border);
  }
</style>
