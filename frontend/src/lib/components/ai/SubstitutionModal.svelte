<script lang="ts">
  import AIBadge from './AIBadge.svelte';
  import AIButton from './AIButton.svelte';
  import { trpc } from '$lib/trpc/client';

  interface Substitution {
    substitute: string;
    ratio: string;
    notes: string;
    suitableFor: string[];
  }

  interface Props {
    ingredient: string;
    recipeTitle?: string;
    onClose: () => void;
  }

  let { ingredient, recipeTitle, onClose }: Props = $props();

  let loading = $state(true);
  let error = $state('');
  let substitutions = $state<Substitution[]>([]);

  $effect(() => {
    loadSubstitutions();
  });

  async function loadSubstitutions() {
    loading = true;
    error = '';

    try {
      const result = await trpc.ai.suggestSubstitutions.mutate({
        ingredient,
        context: recipeTitle,
      });
      substitutions = result;
    } catch (err: any) {
      error = err.message || 'Failed to get substitutions';
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
        <h3>Substitutes for</h3>
        <p class="ingredient-name">{ingredient}</p>
      </div>
      <button class="btn-close" onclick={onClose}>&times;</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Finding substitutes...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <AIButton onclick={loadSubstitutions} label="Try Again" variant="subtle" />
        </div>
      {:else if substitutions.length === 0}
        <div class="empty-state">
          <p>No substitutions found for this ingredient.</p>
        </div>
      {:else}
        <div class="substitutions-list">
          {#each substitutions as sub}
            <div class="substitution-card">
              <div class="sub-header">
                <span class="sub-name">{sub.substitute}</span>
                <span class="sub-ratio">{sub.ratio}</span>
              </div>
              <p class="sub-notes">{sub.notes}</p>
              {#if sub.suitableFor.length > 0}
                <div class="suitable-for">
                  {#each sub.suitableFor as use}
                    <span class="use-tag">{use}</span>
                  {/each}
                </div>
              {/if}
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
    max-width: 480px;
    max-height: 80vh;
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
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-light);
  }

  .ingredient-name {
    margin: var(--spacing-1) 0 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
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

  .substitutions-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .substitution-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3) var(--spacing-4);
  }

  .sub-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-2);
  }

  .sub-name {
    font-weight: 600;
    font-size: var(--text-base);
  }

  .sub-ratio {
    font-size: var(--text-sm);
    color: var(--color-primary);
    font-weight: 500;
    white-space: nowrap;
  }

  .sub-notes {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  .suitable-for {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-1);
    margin-top: var(--spacing-2);
  }

  .use-tag {
    font-size: var(--text-xs);
    background: var(--color-surface);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-full);
    color: var(--color-text-light);
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
