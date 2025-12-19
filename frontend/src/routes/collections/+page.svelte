<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';

  let collections = $state<any[]>([]);
  let autoCollections = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showCreateForm = $state(false);
  let editingCollection = $state<any>(null);

  // Form data
  let name = $state('');
  let description = $state('');

  onMount(() => {
    loadCollections();
  });

  async function loadCollections() {
    loading = true;
    error = '';
    try {
      const [userCollections, tagCollections] = await Promise.all([
        trpc.collection.list.query(),
        trpc.tag.listAsCollections.query(),
      ]);
      collections = userCollections;
      autoCollections = tagCollections;
    } catch (err: any) {
      error = err.message || 'Failed to load collections';
    } finally {
      loading = false;
    }
  }

  function startCreate() {
    name = '';
    description = '';
    editingCollection = null;
    showCreateForm = true;
  }

  function startEdit(collection: any) {
    name = collection.name;
    description = collection.description || '';
    editingCollection = collection;
    showCreateForm = true;
  }

  function cancelForm() {
    showCreateForm = false;
    editingCollection = null;
    name = '';
    description = '';
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    try {
      if (editingCollection) {
        await trpc.collection.update.mutate({
          id: editingCollection.id,
          name,
          description: description.trim() || undefined,
        });
      } else {
        await trpc.collection.create.mutate({
          name,
          description: description.trim() || undefined,
        });
      }

      cancelForm();
      loadCollections();
    } catch (err: any) {
      alert('Failed to save collection: ' + err.message);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await trpc.collection.delete.mutate({ id });
      loadCollections();
    } catch (err: any) {
      alert('Failed to delete collection: ' + err.message);
    }
  }

  function viewCollection(id: string, isAutoCollection = false) {
    if (isAutoCollection) {
      // Extract tagId from the id format "tag:uuid"
      const tagId = id.replace('tag:', '');
      goto(`/collections/tag/${tagId}`);
    } else {
      goto(`/collections/${id}`);
    }
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="header">
      <h1>My Collections</h1>
      <button onclick={startCreate} class="btn-create">
        + New Collection
      </button>
    </div>

    {#if loading}
      <div class="loading">Loading collections...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else}
      {#if showCreateForm}
        <div class="form-overlay">
          <div class="form-card">
            <h2>{editingCollection ? 'Edit Collection' : 'Create New Collection'}</h2>
            <form onsubmit={handleSubmit}>
              <div class="form-group">
                <label for="name">Name *</label>
                <input
                  id="name"
                  type="text"
                  bind:value={name}
                  required
                  maxlength="100"
                  placeholder="e.g., Quick Weeknight Dinners"
                />
              </div>

              <div class="form-group">
                <label for="description">Description</label>
                <textarea
                  id="description"
                  bind:value={description}
                  maxlength="500"
                  rows="3"
                  placeholder="Optional description for this collection"
                ></textarea>
              </div>

              <div class="form-actions">
                <button type="button" onclick={cancelForm} class="btn-cancel">
                  Cancel
                </button>
                <button type="submit" class="btn-submit">
                  {editingCollection ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      {/if}

      {#if collections.length === 0 && autoCollections.length === 0}
        <div class="empty-state">
          <p>No collections yet</p>
          <p class="empty-subtitle">Create collections to organize your recipes, or add tags to recipes to auto-generate collections</p>
          <button onclick={startCreate} class="btn-create-large">
            Create Your First Collection
          </button>
        </div>
      {:else}
        {#if collections.length > 0}
          <div class="section">
            <h2 class="section-title">My Collections</h2>
            <div class="collections-grid">
              {#each collections as collection}
                <div class="collection-card">
                  <div class="collection-header">
                    <h3>{collection.name}</h3>
                    <div class="recipe-count">
                      {collection.recipeCount} {collection.recipeCount === 1 ? 'recipe' : 'recipes'}
                    </div>
                  </div>

                  <div class="description-wrapper">
                    {#if collection.description}
                      <p class="description">{collection.description}</p>
                    {/if}
                  </div>

                  <div class="collection-actions">
                    <button
                      onclick={() => viewCollection(collection.id)}
                      class="btn-view"
                    >
                      View Collection
                    </button>
                    <button
                      onclick={() => startEdit(collection)}
                      class="btn-icon"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onclick={() => handleDelete(collection.id, collection.name)}
                      class="btn-icon"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if autoCollections.length > 0}
          <div class="section">
            <h2 class="section-title">
              <span class="auto-badge">Auto</span>
              Tag Collections
            </h2>
            <p class="section-subtitle">Automatically created from recipe tags with 2+ recipes</p>
            <div class="collections-grid">
              {#each autoCollections as collection}
                <div class="collection-card auto-collection">
                  <div class="collection-header">
                    <h3>{collection.name}</h3>
                    <div class="recipe-count">
                      {collection.recipeCount} {collection.recipeCount === 1 ? 'recipe' : 'recipes'}
                    </div>
                  </div>

                  <div class="description-wrapper">
                    <p class="description">{collection.description}</p>
                  </div>

                  <div class="collection-actions">
                    <button
                      onclick={() => viewCollection(collection.id, true)}
                      class="btn-view"
                    >
                      View Collection
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if collections.length === 0}
          <div class="empty-inline">
            <p>No custom collections yet.</p>
            <button onclick={startCreate} class="btn-create-inline">
              + Create Collection
            </button>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: 2rem 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--color-text);
  }

  .btn-create {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-create:hover {
    background: var(--color-primary-dark);
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-light);
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .form-overlay {
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
    padding: 1rem;
  }

  .form-card {
    background: white;
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .form-card h2 {
    margin: 0 0 1.5rem;
    font-size: 1.5rem;
    color: var(--color-text);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .btn-cancel {
    padding: 0.75rem 1.5rem;
    background: white;
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-submit {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .empty-state p {
    margin: 0;
    font-size: 1.5rem;
    color: var(--color-text);
  }

  .empty-subtitle {
    font-size: 1rem !important;
    color: var(--color-text-light) !important;
    margin-top: 0.5rem !important;
  }

  .btn-create-large {
    margin-top: 2rem;
    padding: 1rem 2rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 1.125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .collections-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .collection-card {
    background: white;
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
  }

  .collection-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .collection-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .collection-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-text);
    flex: 1;
  }

  .recipe-count {
    background: var(--color-bg-subtle);
    color: var(--color-primary);
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-full);
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    margin-left: 0.5rem;
  }

  .description-wrapper {
    flex: 1;
  }

  .description {
    color: var(--color-text-light);
    line-height: 1.5;
    margin: 0;
  }

  .collection-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: auto;
  }

  .btn-view {
    flex: 1;
    padding: 0.75rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-icon {
    padding: 0.75rem;
    background: var(--color-bg-subtle);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-icon:hover {
    background: var(--color-border);
  }

  .section {
    margin-bottom: 2.5rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: var(--color-text);
  }

  .section-subtitle {
    margin: 0 0 1rem;
    color: var(--color-text-light);
    font-size: 0.875rem;
  }

  .auto-badge {
    background: var(--color-primary);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .auto-collection {
    border-left: 3px solid var(--color-primary);
  }

  .empty-inline {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    margin-top: 1.5rem;
  }

  .empty-inline p {
    margin: 0;
    color: var(--color-text-light);
  }

  .btn-create-inline {
    padding: 0.5rem 1rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .collections-grid {
      grid-template-columns: 1fr;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-create {
      width: 100%;
    }
  }
</style>
