<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';

  let tags = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let editingTag = $state<{id: string, name: string} | null>(null);
  let newName = $state('');
  let mergingTag = $state<{id: string, name: string} | null>(null);
  let targetTagId = $state('');

  onMount(() => {
    loadTags();
  });

  async function loadTags() {
    loading = true;
    error = '';
    try {
      tags = await trpc.tag.list.query();
    } catch (err: any) {
      error = err.message || 'Failed to load tags';
    } finally {
      loading = false;
    }
  }

  function handleTagClick(tagName: string) {
    // Navigate to homepage with tag filter
    goto(`/?tag=${encodeURIComponent(tagName)}`);
  }

  function startEdit(tag: any) {
    editingTag = { id: tag.id, name: tag.name };
    newName = tag.name;
  }

  function cancelEdit() {
    editingTag = null;
    newName = '';
  }

  async function saveRename() {
    if (!editingTag || !newName.trim()) return;

    try {
      await trpc.tag.rename.mutate({
        id: editingTag.id,
        newName: newName.trim(),
      });
      await loadTags();
      editingTag = null;
      newName = '';
    } catch (err: any) {
      alert('Failed to rename tag: ' + err.message);
    }
  }

  async function handleDelete(tag: any) {
    if (!confirm(`Delete tag "${tag.name}"? This only works for unused tags.`)) return;

    try {
      await trpc.tag.delete.mutate({ id: tag.id });
      await loadTags();
    } catch (err: any) {
      alert('Failed to delete tag: ' + err.message);
    }
  }

  function startMerge(tag: any) {
    mergingTag = { id: tag.id, name: tag.name };
    targetTagId = '';
  }

  function cancelMerge() {
    mergingTag = null;
    targetTagId = '';
  }

  async function saveMerge() {
    if (!mergingTag || !targetTagId) return;

    try {
      await trpc.tag.merge.mutate({
        sourceTagId: mergingTag.id,
        targetTagId,
      });
      await loadTags();
      mergingTag = null;
      targetTagId = '';
    } catch (err: any) {
      alert('Failed to merge tags: ' + err.message);
    }
  }

  function getTagColor(index: number): string {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-yellow-100 text-yellow-800',
      'bg-red-100 text-red-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
      'bg-orange-100 text-orange-800',
    ];
    return colors[index % colors.length];
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="header">
      <h2>🏷️ Browse Tags</h2>
      <a href="/" class="btn-secondary">← Back to Recipes</a>
    </div>

    <p class="description">
      Click on a tag to see all recipes with that tag. You can also manage your tags here.
    </p>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Loading tags...</div>
    {:else if tags.length === 0}
      <div class="empty">
        <p>No tags found. Tags are automatically created when you add them to recipes.</p>
        <a href="/recipe/new" class="btn-primary">Create a Recipe</a>
      </div>
    {:else}
      <div class="tag-grid">
        {#each tags as tag, index (tag.id)}
          <div class="tag-card {getTagColor(index)}">
            <div class="tag-header">
              {#if editingTag?.id === tag.id}
                <input
                  type="text"
                  bind:value={newName}
                  class="tag-edit-input"
                  onkeydown={(e) => e.key === 'Enter' && saveRename()}
                />
              {:else}
                <button
                  class="tag-name"
                  onclick={() => handleTagClick(tag.name)}
                >
                  {tag.name}
                </button>
              {/if}
              <span class="recipe-count">{tag.recipeCount} {tag.recipeCount === 1 ? 'recipe' : 'recipes'}</span>
            </div>

            <div class="tag-actions">
              {#if editingTag?.id === tag.id}
                <button onclick={saveRename} class="btn-sm btn-success">✓</button>
                <button onclick={cancelEdit} class="btn-sm btn-cancel">✗</button>
              {:else if mergingTag?.id === tag.id}
                <div class="merge-controls">
                  <select bind:value={targetTagId} class="merge-select">
                    <option value="">Select target tag...</option>
                    {#each tags.filter(t => t.id !== tag.id) as t}
                      <option value={t.id}>{t.name}</option>
                    {/each}
                  </select>
                  <button onclick={saveMerge} class="btn-sm btn-success" disabled={!targetTagId}>✓</button>
                  <button onclick={cancelMerge} class="btn-sm btn-cancel">✗</button>
                </div>
              {:else}
                <button onclick={() => startEdit(tag)} class="btn-sm" title="Rename">✏️</button>
                <button onclick={() => startMerge(tag)} class="btn-sm" title="Merge">🔀</button>
                <button onclick={() => handleDelete(tag)} class="btn-sm btn-danger" title="Delete">🗑️</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: var(--spacing-2xl) 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-lg);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
    flex-wrap: wrap;
    gap: var(--spacing-lg);
  }

  h2 {
    margin: 0;
    font-size: 2.5rem;
    color: var(--color-text);
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .description {
    color: var(--color-text-light);
    margin-bottom: var(--spacing-xl);
    font-size: 1.125rem;
  }

  .btn-secondary {
    padding: var(--spacing-md) var(--spacing-xl);
    border-radius: var(--radius-lg);
    text-decoration: none;
    font-weight: 600;
    background: var(--color-surface);
    color: var(--color-primary);
    border: 2px solid var(--color-primary);
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--color-bg-subtle);
    transform: translateY(-2px);
  }

  .btn-primary {
    padding: var(--spacing-md) var(--spacing-xl);
    border-radius: var(--radius-lg);
    text-decoration: none;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    color: white;
    border: none;
  }

  .error {
    background: #ffe5e5;
    color: var(--color-error);
    padding: var(--spacing-lg);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-xl);
    border-left: 4px solid var(--color-error);
    font-weight: 500;
  }

  .loading {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--color-text-light);
    font-size: 1.125rem;
  }

  .empty {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--color-text-light);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .empty p {
    margin-bottom: var(--spacing-lg);
    font-size: 1.125rem;
  }

  .tag-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-lg);
    animation: fadeIn 0.4s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .tag-card {
    padding: var(--spacing-lg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    transition: all 0.2s;
  }

  .tag-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .tag-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    gap: var(--spacing-sm);
  }

  .tag-name {
    font-size: 1.25rem;
    font-weight: 600;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    flex: 1;
    padding: 0;
    color: inherit;
  }

  .tag-name:hover {
    text-decoration: underline;
  }

  .tag-edit-input {
    flex: 1;
    padding: var(--spacing-sm);
    border: 2px solid currentColor;
    border-radius: var(--radius-md);
    font-size: 1.125rem;
    font-weight: 600;
    background: white;
  }

  .recipe-count {
    font-size: 0.875rem;
    font-weight: 500;
    opacity: 0.8;
    white-space: nowrap;
  }

  .tag-actions {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .merge-controls {
    display: flex;
    gap: var(--spacing-sm);
    flex: 1;
  }

  .merge-select {
    flex: 1;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    background: white;
  }

  .btn-sm {
    padding: var(--spacing-xs) var(--spacing-sm);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 0.875rem;
    background: rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }

  .btn-sm:hover {
    background: rgba(0, 0, 0, 0.2);
  }

  .btn-success {
    background: #22c55e;
    color: white;
  }

  .btn-success:hover {
    background: #16a34a;
  }

  .btn-cancel {
    background: #6b7280;
    color: white;
  }

  .btn-cancel:hover {
    background: #4b5563;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .btn-sm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .tag-grid {
      grid-template-columns: 1fr;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
    }

    h2 {
      font-size: 2rem;
      text-align: center;
    }
  }
</style>
