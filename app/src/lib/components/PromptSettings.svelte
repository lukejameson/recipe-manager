<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/client';
  import PromptEditor from '$lib/components/PromptEditor.svelte';

  interface Props {
    isAdmin?: boolean;
  }
  let { isAdmin = false }: Props = $props();

  type Prompt = {
    featureId: string;
    content: string;
    version: number;
    updatedAt: Date | null;
    updatedBy: string | null;
    updatedByUsername: string | null;
    variables: Array<{ name: string; description: string; sampleValue: string }>;
    isDefault: boolean;
  };

  let prompts: Prompt[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let success = $state('');
  let selectedPrompt: Prompt | null = $state(null);
  let resetting = $state('');

  const categoryOrder = ['chat', 'generation', 'enhancement', 'analysis'];
  const categoryNames: Record<string, string> = {
    chat: 'Chat & Conversation',
    generation: 'Recipe Generation',
    enhancement: 'Recipe Enhancement',
    analysis: 'Analysis & Matching',
  };

  function getCategory(featureId: string): string {
    const parts = featureId.split('_');
    return parts[parts.length - 1];
  }

  function getFeatureDisplayName(featureId: string): string {
    return featureId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function groupByCategory(list: Prompt[]): Map<string, Prompt[]> {
    const grouped = new Map<string, Prompt[]>();
    for (const p of list) {
      const cat = getCategory(p.featureId);
      const arr = grouped.get(cat) || [];
      arr.push(p);
      grouped.set(cat, arr);
    }
    return grouped;
  }

  async function loadPrompts() {
    loading = true;
    error = '';
    try {
      const result = await apiClient.getPrompts();
      prompts = result.prompts;
    } catch (err: any) {
      error = err.message || 'Failed to load prompts';
    } finally {
      loading = false;
    }
  }

  async function handleSave(featureId: string, content: string) {
    await apiClient.updatePrompt(featureId, content);
    success = 'Prompt saved!';
    await loadPrompts();
    setTimeout(() => { success = ''; }, 3000);
  }

  async function handleReset(featureId: string) {
    if (!confirm(`Reset "${getFeatureDisplayName(featureId)}" prompt to default?`)) return;
    resetting = featureId;
    error = '';
    try {
      await apiClient.resetPrompt(featureId);
      success = 'Prompt reset to default!';
      await loadPrompts();
      setTimeout(() => { success = ''; }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to reset prompt';
    } finally {
      resetting = '';
    }
  }

  onMount(loadPrompts);
</script>

<div class="section-header">
  <div>
    <h2>Prompt Templates</h2>
    <p class="section-description">
      Customize the AI prompts used for each feature. Changes take effect immediately.
    </p>
  </div>
</div>

{#if success}
  <div class="success-message">{success}</div>
{/if}
{#if error}
  <div class="error-message">{error}</div>
{/if}

{#if loading}
  <div class="loading">Loading prompts...</div>
{:else if prompts.length === 0}
  <div class="empty-state">
    <p>No prompts found.</p>
  </div>
{:else}
  {#each categoryOrder as category}
    {@const categoryPrompts = groupByCategory(prompts).get(category) || []}
    {#if categoryPrompts.length > 0}
      <div class="prompt-category">
        <h3>{categoryNames[category] || category}</h3>
        <div class="prompts-list">
          {#each categoryPrompts as prompt}
            <div class="prompt-card">
              <div class="prompt-info">
                <div class="prompt-header">
                  <h4>{getFeatureDisplayName(prompt.featureId)}</h4>
                  {#if prompt.isDefault}
                    <span class="badge default">Default</span>
                  {:else}
                    <span class="badge customized">v{prompt.version} Customized</span>
                  {/if}
                </div>
                {#if !prompt.isDefault && prompt.updatedByUsername}
                  <p class="prompt-meta">
                    Last edited by {prompt.updatedByUsername}
                    {#if prompt.updatedAt}
                      &bull; {new Date(prompt.updatedAt).toLocaleDateString()}
                    {/if}
                  </p>
                {/if}
                {#if prompt.variables.length > 0}
                  <div class="variable-chips">
                    {#each prompt.variables as v}
                      <span class="variable-chip"><code>{`{{${v.name}}}`}</code></span>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="prompt-actions">
                <button class="btn-secondary" onclick={() => selectedPrompt = prompt}>
                  Edit
                </button>
                {#if !prompt.isDefault && isAdmin}
                  <button
                    class="btn-text-danger"
                    onclick={() => handleReset(prompt.featureId)}
                    disabled={resetting === prompt.featureId}
                  >
                    {resetting === prompt.featureId ? 'Resetting...' : 'Reset'}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
{/if}

{#if selectedPrompt}
  <PromptEditor
    prompt={selectedPrompt}
    onClose={() => selectedPrompt = null}
    onSave={(content) => handleSave(selectedPrompt!.featureId, content)}
  />
{/if}

<style>
  .section-header {
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1.25rem;
    margin: 0 0 0.5rem;
    color: var(--color-text);
  }

  .section-description {
    color: var(--color-text-light);
    margin: 0;
    line-height: 1.5;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-light);
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-light);
  }

  .success-message {
    background: #dcfce7;
    color: #166534;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .prompt-category {
    margin-bottom: 2rem;
  }

  .prompt-category:last-child {
    margin-bottom: 0;
  }

  .prompt-category h3 {
    font-size: 1rem;
    color: var(--color-text-light);
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .prompts-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .prompt-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .prompt-info {
    flex: 1;
  }

  .prompt-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
  }

  .prompt-header h4 {
    margin: 0;
    font-size: 1rem;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge.default {
    background: #dbeafe;
    color: #1e40af;
  }

  .badge.customized {
    background: #dcfce7;
    color: #166534;
  }

  .prompt-meta {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    color: var(--color-text-light);
  }

  .variable-chips {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .variable-chip code {
    background: white;
    padding: 0.15rem 0.4rem;
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
    color: var(--color-primary);
    border: 1px solid var(--color-border);
  }

  .prompt-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-shrink: 0;
    margin-left: 1rem;
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: white;
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--color-primary);
  }

  .btn-text-danger {
    background: none;
    border: none;
    color: #dc2626;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0;
  }

  .btn-text-danger:hover:not(:disabled) {
    text-decoration: underline;
  }

  .btn-text-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
