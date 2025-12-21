<script lang="ts">
  import AIBadge from './AIBadge.svelte';

  interface TagSuggestion {
    tag: string;
    confidence: number;
    reason: string;
  }

  interface Props {
    suggestions: TagSuggestion[];
    selectedTags: string[];
    onSelect: (tag: string) => void;
    onDismiss: () => void;
  }

  let { suggestions, selectedTags, onSelect, onDismiss }: Props = $props();

  function isSelected(tag: string): boolean {
    return selectedTags.some((t) => t.toLowerCase() === tag.toLowerCase());
  }

  function getConfidenceClass(confidence: number): string {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }
</script>

<div class="tag-suggestions-panel">
  <div class="panel-header">
    <AIBadge />
    <button class="btn-dismiss" onclick={onDismiss} title="Dismiss suggestions">&times;</button>
  </div>

  <div class="suggestions-list">
    {#each suggestions as suggestion}
      <button
        class="suggestion-chip {getConfidenceClass(suggestion.confidence)}"
        class:selected={isSelected(suggestion.tag)}
        onclick={() => onSelect(suggestion.tag)}
        disabled={isSelected(suggestion.tag)}
        title={suggestion.reason}
      >
        <span class="tag-name">{suggestion.tag}</span>
        {#if isSelected(suggestion.tag)}
          <span class="check">✓</span>
        {:else}
          <span class="add">+</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .tag-suggestions-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
    margin-top: var(--spacing-2);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2);
  }

  .btn-dismiss {
    background: none;
    border: none;
    color: var(--color-text-light);
    font-size: var(--text-lg);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
  }

  .btn-dismiss:hover {
    color: var(--color-text);
  }

  .suggestions-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .suggestion-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .suggestion-chip:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: var(--color-primary);
    background: rgba(255, 107, 53, 0.1);
  }

  .suggestion-chip.selected {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
    cursor: default;
  }

  .suggestion-chip:disabled {
    opacity: 0.8;
  }

  .suggestion-chip.high {
    border-left: 3px solid var(--color-success);
  }

  .suggestion-chip.medium {
    border-left: 3px solid var(--color-warning);
  }

  .suggestion-chip.low {
    border-left: 3px solid var(--color-border);
  }

  .add,
  .check {
    font-size: var(--text-xs);
    opacity: 0.7;
  }

  .check {
    opacity: 1;
  }
</style>
