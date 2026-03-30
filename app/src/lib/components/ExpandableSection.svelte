<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';

  interface Props {
    title: string;
    expanded?: boolean;
    onToggle?: () => void;
    children?: import('svelte').Snippet;
  }

  let { title, expanded = $bindable(false), onToggle, children }: Props = $props();

  function toggle() {
    expanded = !expanded;
    onToggle?.();
  }
</script>

<div class="expandable-section" class:expanded>
  <button
    type="button"
    class="expandable-toggle"
    onclick={toggle}
    aria-expanded={expanded}
  >
    <span class="toggle-title">{title}</span>
    <ChevronDown size={20} class="toggle-icon" />
  </button>

  {#if expanded}
    <div class="expandable-content">
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  .expandable-section {
    border: 2px solid var(--color-border, #D5D5D5);
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    margin-bottom: var(--spacing-5);
  }

  .expandable-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4);
    background: var(--color-bg-subtle, #F7F2EA);
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .expandable-toggle:hover {
    background: var(--color-border-light, #E5E0D8);
  }

  .toggle-title {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text, #2D2D2D);
  }

  :global(.toggle-icon) {
    color: var(--color-text-light, #7A8B94);
    transition: transform 0.2s ease;
  }

  .expanded :global(.toggle-icon) {
    transform: rotate(180deg);
  }

  .expandable-content {
    padding: var(--spacing-4);
    background: var(--color-surface, #ffffff);
    border-top: 1px solid var(--color-border-light, #E5E0D8);
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .expandable-section {
      margin-bottom: var(--spacing-4);
    }

    .expandable-toggle {
      padding: var(--spacing-3) var(--spacing-4);
      min-height: 48px;
    }

    .toggle-title {
      font-size: var(--text-sm);
    }

    .expandable-content {
      padding: var(--spacing-3);
    }
  }
</style>
