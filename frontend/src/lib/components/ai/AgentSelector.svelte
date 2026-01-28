<script lang="ts">
  import { onMount } from 'svelte';
  import { trpc } from '$lib/trpc/client';

  interface Agent {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    modelId: string | null;
    isBuiltIn: boolean;
  }

  export interface SelectedAgentInfo {
    id: string | null;
    name: string;
    icon: string;
    modelId: string | null;
  }

  interface Props {
    selectedAgentId?: string | null;
    onSelect?: (agentId: string | null, agentInfo: SelectedAgentInfo) => void;
  }

  let { selectedAgentId = $bindable(null), onSelect }: Props = $props();

  let agents = $state<Agent[]>([]);
  let loading = $state(true);
  let expanded = $state(false);
  let error = $state('');

  onMount(async () => {
    try {
      agents = await trpc.agents.list.query();
    } catch (err: any) {
      console.error('Failed to load agents:', err);
      error = err.message || 'Failed to load agents';
    } finally {
      loading = false;
    }
  });

  function handleSelect(agentId: string | null) {
    selectedAgentId = agentId;
    expanded = false;
    const agent = agentId ? agents.find((a) => a.id === agentId) : null;
    const agentInfo: SelectedAgentInfo = {
      id: agentId,
      name: agent?.name || 'Default',
      icon: agent?.icon || '🤖',
      modelId: agent?.modelId || null,
    };
    onSelect?.(agentId, agentInfo);
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.agent-selector')) {
      expanded = false;
    }
  }

  $effect(() => {
    if (expanded) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });

  const selectedAgent = $derived(agents.find((a) => a.id === selectedAgentId));
</script>

<div class="agent-selector">
  <button
    class="selector-trigger"
    onclick={() => (expanded = !expanded)}
    disabled={loading}
    title="Select AI Agent"
  >
    <span class="agent-icon">{selectedAgent?.icon || '🤖'}</span>
    <span class="agent-name">{selectedAgent?.name || 'Default'}</span>
    <svg class="chevron" class:expanded viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>

  {#if expanded}
    <div class="dropdown-backdrop" onclick={() => (expanded = false)}></div>
    <div class="dropdown">
      <button
        class="agent-option"
        class:selected={!selectedAgentId}
        onclick={() => handleSelect(null)}
      >
        <span class="agent-icon">🤖</span>
        <div class="agent-info">
          <span class="agent-option-name">Default</span>
          <span class="agent-desc">General recipe assistant</span>
        </div>
      </button>

      {#each agents as agent}
        <button
          class="agent-option"
          class:selected={selectedAgentId === agent.id}
          onclick={() => handleSelect(agent.id)}
        >
          <span class="agent-icon">{agent.icon}</span>
          <div class="agent-info">
            <span class="agent-option-name">{agent.name}</span>
            {#if agent.description}
              <span class="agent-desc">{agent.description}</span>
            {/if}
          </div>
          {#if !agent.isBuiltIn}
            <span class="custom-badge">Custom</span>
          {/if}
        </button>
      {/each}

      <a href="/agents" class="manage-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m17.36-5.64l-4.24 4.24m-2.24 2.24l-4.24 4.24M19.78 19.78l-4.24-4.24m-2.24-2.24l-4.24-4.24" />
        </svg>
        Manage Agents
      </a>
    </div>
  {/if}
</div>

<style>
  .agent-selector {
    position: relative;
  }

  .selector-trigger {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-2);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    color: var(--color-text);
    cursor: pointer;
    transition: var(--transition-fast);
    height: 100%;
  }

  .selector-trigger:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: var(--color-background);
  }

  .selector-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .agent-icon {
    font-size: var(--text-base);
    line-height: 1;
  }

  .agent-name {
    font-weight: 500;
  }

  .chevron {
    width: 12px;
    height: 12px;
    transition: transform 0.2s ease;
    opacity: 0.5;
  }

  .chevron.expanded {
    transform: rotate(180deg);
  }

  .dropdown {
    position: absolute;
    bottom: calc(100% + var(--spacing-1));
    right: 0;
    min-width: 280px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    overflow: hidden;
  }

  .agent-option {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-3);
    width: 100%;
    padding: var(--spacing-3);
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .agent-option:hover {
    background: var(--color-background);
  }

  .agent-option.selected {
    background: rgba(74, 158, 255, 0.1);
  }

  .agent-option .agent-icon {
    font-size: var(--text-xl);
    flex-shrink: 0;
  }

  .agent-info {
    flex: 1;
    min-width: 0;
  }

  .agent-option-name {
    display: block;
    font-weight: 500;
    color: var(--color-text);
    font-size: var(--text-sm);
  }

  .agent-desc {
    display: block;
    font-size: var(--text-xs);
    color: var(--color-text-light);
    margin-top: 2px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .custom-badge {
    padding: 2px 6px;
    background: var(--color-background);
    border-radius: var(--radius-full);
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-lighter);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .manage-link {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    border-top: 1px solid var(--color-border);
    color: var(--color-primary);
    font-size: var(--text-sm);
    font-weight: 500;
    text-decoration: none;
    transition: var(--transition-fast);
  }

  .manage-link:hover {
    background: var(--color-background);
  }

  .manage-link svg {
    width: 16px;
    height: 16px;
  }

  /* Dropdown Backdrop */
  .dropdown-backdrop {
    display: none;
  }

  /* Mobile Styles */
  @media (max-width: 768px) {
    .selector-trigger {
      min-height: 44px;
      padding: var(--spacing-2);
      min-width: 44px;
      justify-content: center;
    }

    .agent-name,
    .chevron {
      display: none;
    }

    .agent-icon {
      font-size: var(--text-xl);
    }

    .dropdown-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 250;
    }

    .dropdown {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      bottom: auto;
      right: auto;
      max-width: 90vw;
      max-height: 70vh;
      overflow-y: auto;
      z-index: 300;
    }

    .agent-option,
    .manage-link {
      min-height: 44px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .dropdown-backdrop {
      animation: none;
    }
  }
</style>
