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
    padding: var(--spacing-12) 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-6);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-8);
    flex-wrap: wrap;
    gap: var(--spacing-6);
  }

  h2 {
    margin: 0;
    font-size: var(--text-3xl);
    color: var(--color-text);
    font-weight: var(--font-extrabold);
    letter-spacing: -0.025em;
  }

  .description {
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-8);
    font-size: var(--text-lg);
    line-height: var(--leading-relaxed);
  }

  .btn-secondary {
    padding: var(--spacing-3) var(--spacing-5);
    border-radius: var(--radius-lg);
    text-decoration: none;
    font-weight: var(--font-semibold);
    background: var(--color-surface);
    color: var(--color-primary);
    border: 2px solid var(--color-border);
    transition: var(--transition-normal);
    font-size: var(--text-sm);
    box-shadow: var(--shadow-xs);
  }

  .btn-secondary:hover {
    background: var(--color-bg-subtle);
    border-color: var(--color-primary);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-primary {
    padding: var(--spacing-3) var(--spacing-5);
    border-radius: var(--radius-lg);
    text-decoration: none;
    font-weight: var(--font-semibold);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    background: var(--color-primary);
    color: white;
    border: 2px solid var(--color-primary);
    font-size: var(--text-sm);
    box-shadow: var(--shadow-sm);
    transition: var(--transition-normal);
  }

  .error {
    background: #fef2f2;
    color: var(--color-error);
    padding: var(--spacing-4);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-8);
    border-left: 3px solid var(--color-error);
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
    border: 1px solid #fecaca;
  }

  .loading {
    text-align: center;
    padding: var(--spacing-12);
    color: var(--color-text-light);
    font-size: var(--text-lg);
  }

  .empty {
    text-align: center;
    padding: var(--spacing-12);
    color: var(--color-text-secondary);
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xs);
    border: 1px solid var(--color-border-light);
  }

  .empty p {
    margin-bottom: var(--spacing-6);
    font-size: var(--text-lg);
    line-height: var(--leading-relaxed);
  }

  .tag-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-6);
    animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
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
    padding: var(--spacing-6);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xs);
    transition: var(--transition-normal);
    border: 1px solid rgba(255, 255, 255, 0.5);
  }

  .tag-card:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }

  .tag-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
    gap: var(--spacing-3);
  }

  .tag-name {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    flex: 1;
    padding: 0;
    color: inherit;
    transition: var(--transition-fast);
  }

  .tag-name:hover {
    text-decoration: underline;
  }

  .tag-edit-input {
    flex: 1;
    padding: var(--spacing-2);
    border: 2px solid currentColor;
    border-radius: var(--radius-lg);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    background: white;
  }

  .recipe-count {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    opacity: 0.7;
    white-space: nowrap;
  }

  .tag-actions {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .merge-controls {
    display: flex;
    gap: var(--spacing-2);
    flex: 1;
  }

  .merge-select {
    flex: 1;
    padding: var(--spacing-2) var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    background: white;
    color: var(--color-text);
  }

  .btn-sm {
    padding: var(--spacing-1) var(--spacing-2);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-xs);
    background: rgba(0, 0, 0, 0.1);
    transition: var(--transition-fast);
    font-weight: var(--font-medium);
  }

  .btn-sm:hover {
    background: rgba(0, 0, 0, 0.2);
    transform: scale(1.05);
  }

  .btn-success {
    background: var(--color-success);
    color: white;
    border-color: var(--color-success);
  }

  .btn-success:hover {
    background: #059669;
  }

  .btn-cancel {
    background: var(--color-text-light);
    color: white;
    border-color: var(--color-text-light);
  }

  .btn-cancel:hover {
    background: var(--color-text);
  }

  .btn-danger {
    background: var(--color-error);
    color: white;
    border-color: var(--color-error);
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
