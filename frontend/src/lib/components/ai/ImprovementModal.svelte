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

  interface Props {
    recipe: {
      title: string;
      description?: string;
      ingredients: string[];
      instructions: string[];
      prepTime?: number;
      cookTime?: number;
    };
    onClose: () => void;
  }

  let { recipe, onClose }: Props = $props();

  let loading = $state(true);
  let error = $state('');
  let suggestions = $state<ImprovementSuggestion[]>([]);

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
    loadSuggestions();
  });

  async function loadSuggestions() {
    loading = true;
    error = '';

    try {
      const result = await trpc.ai.suggestImprovements.mutate({ recipe });
      suggestions = result;
    } catch (err: any) {
      error = err.message || 'Failed to get suggestions';
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
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <AIButton onclick={loadSuggestions} label="Try Again" variant="subtle" />
        </div>
      {:else if suggestions.length === 0}
        <div class="empty-state">
          <p>This recipe looks great as is!</p>
        </div>
      {:else}
        <div class="suggestions-list">
          {#each suggestions as suggestion}
            <div class="suggestion-card {suggestion.priority}">
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
          {/each}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <AIBadge />
      <button class="btn-secondary" onclick={onClose}>Close</button>
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

  .suggestions-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .suggestion-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    border-left: 3px solid var(--color-border);
  }

  .suggestion-card.high {
    border-left-color: var(--color-success);
  }

  .suggestion-card.medium {
    border-left-color: var(--color-warning);
  }

  .suggestion-card.low {
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
</style>
