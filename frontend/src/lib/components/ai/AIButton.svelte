<script lang="ts">
  interface Props {
    onclick: () => void;
    loading?: boolean;
    disabled?: boolean;
    label?: string;
    loadingLabel?: string;
    size?: 'sm' | 'md';
    variant?: 'primary' | 'subtle';
  }

  let {
    onclick,
    loading = false,
    disabled = false,
    label = 'AI',
    loadingLabel = 'Working...',
    size = 'md',
    variant = 'subtle',
  }: Props = $props();
</script>

<button
  class="ai-btn {size} {variant}"
  {onclick}
  disabled={loading || disabled}
  title={label}
>
  {#if loading}
    <span class="spinner"></span>
    <span class="label">{loadingLabel}</span>
  {:else}
    <span class="ai-badge">AI</span>
    <span class="label">{label}</span>
  {/if}
</button>

<style>
  .ai-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
  }

  .ai-btn.md {
    padding: 0.5rem 0.75rem;
    font-size: var(--text-sm);
  }

  .ai-btn.sm {
    padding: 0.25rem 0.5rem;
    font-size: var(--text-xs);
    gap: 0.25rem;
  }

  /* Subtle variant - blends in more */
  .ai-btn.subtle {
    background: var(--color-surface);
    color: var(--color-text-light);
    border: 1px solid var(--color-border);
  }

  .ai-btn.subtle:hover:not(:disabled) {
    background: var(--color-background);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .ai-btn.subtle .ai-badge {
    background: var(--color-border);
    color: var(--color-text-light);
  }

  .ai-btn.subtle:hover:not(:disabled) .ai-badge {
    background: var(--color-primary);
    color: white;
  }

  /* Primary variant - more prominent */
  .ai-btn.primary {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
  }

  .ai-btn.primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .ai-btn.primary .ai-badge {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .ai-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .ai-badge {
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    transition: var(--transition-fast);
  }

  .sm .ai-badge {
    padding: 0.0625rem 0.25rem;
    font-size: 0.5rem;
  }

  .label {
    display: none;
  }

  @media (min-width: 640px) {
    .label {
      display: inline;
    }
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    opacity: 0.7;
  }

  .sm .spinner {
    width: 12px;
    height: 12px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
