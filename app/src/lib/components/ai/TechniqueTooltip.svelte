<script lang="ts">
  import AIBadge from './AIBadge.svelte';

  interface TechniqueExplanation {
    term: string;
    definition: string;
    steps?: string[];
    tips?: string[];
  }

  interface Props {
    explanation: TechniqueExplanation;
    onClose: () => void;
  }

  let { explanation, onClose }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="tooltip-backdrop" onclick={onClose}>
  <div class="tooltip-content" onclick={(e) => e.stopPropagation()}>
    <div class="tooltip-header">
      <h4>{explanation.term}</h4>
      <button class="btn-close" onclick={onClose}>&times;</button>
    </div>

    <p class="definition">{explanation.definition}</p>

    {#if explanation.steps?.length}
      <div class="section">
        <h5>How to do it:</h5>
        <ol class="steps">
          {#each explanation.steps as step}
            <li>{step}</li>
          {/each}
        </ol>
      </div>
    {/if}

    {#if explanation.tips?.length}
      <div class="section">
        <h5>Tips:</h5>
        <ul class="tips">
          {#each explanation.tips as tip}
            <li>{tip}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="tooltip-footer">
      <AIBadge />
    </div>
  </div>
</div>

<style>
  .tooltip-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-4);
  }

  .tooltip-content {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
  }

  .tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
  }

  .tooltip-header h4 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    text-transform: capitalize;
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

  .definition {
    padding: var(--spacing-4);
    margin: 0;
    font-size: var(--text-base);
    line-height: 1.6;
    color: var(--color-text);
  }

  .section {
    padding: 0 var(--spacing-4) var(--spacing-3);
  }

  .section h5 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-light);
  }

  .steps,
  .tips {
    margin: 0;
    padding-left: var(--spacing-5);
    font-size: var(--text-sm);
    line-height: 1.6;
  }

  .steps li,
  .tips li {
    margin-bottom: var(--spacing-1);
  }

  .tooltip-footer {
    padding: var(--spacing-3) var(--spacing-4);
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
  }
</style>
