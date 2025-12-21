<script lang="ts">
  interface Props {
    size?: 'sm' | 'md';
  }

  let { size = 'sm' }: Props = $props();
</script>

<span class="ai-generated-badge {size}" title="AI Generated">
  <span class="icon">AI</span>
  <span class="text">Generated</span>
</span>

<style>
  .ai-generated-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-text-lighter);
    font-weight: 500;
  }

  .ai-generated-badge.sm {
    font-size: var(--text-xs);
  }

  .ai-generated-badge.md {
    font-size: var(--text-sm);
  }

  .icon {
    background: var(--color-border);
    color: var(--color-text-light);
    padding: 0.0625rem 0.25rem;
    border-radius: var(--radius-xs);
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.025em;
  }

  .md .icon {
    padding: 0.125rem 0.375rem;
    font-size: 0.625rem;
  }

  .text {
    opacity: 0.8;
  }
</style>
