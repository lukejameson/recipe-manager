<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeCard from '$lib/components/RecipeCard.svelte';

  let collection = $state<any>(null);
  let loading = $state(true);
  let error = $state('');

  onMount(() => {
    loadCollection();
  });

  async function loadCollection() {
    loading = true;
    error = '';
    try {
      collection = await trpc.tag.getRecipes.query({ tagId: $page.params.tagId });
    } catch (err: any) {
      error = err.message || 'Failed to load collection';
    } finally {
      loading = false;
    }
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="header">
      <a href="/collections" class="btn-back">&larr; Back to Collections</a>
    </div>

    {#if loading}
      <div class="loading">Loading collection...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else if collection}
      <div class="collection-header">
        <div>
          <div class="title-row">
            <span class="auto-badge">Auto</span>
            <h1>{collection.name}</h1>
          </div>
          <p class="description">{collection.description}</p>
          <div class="meta">
            {collection.recipes.length} {collection.recipes.length === 1 ? 'recipe' : 'recipes'}
          </div>
        </div>
      </div>

      {#if collection.recipes.length === 0}
        <div class="empty-state">
          <p>No recipes with this tag</p>
        </div>
      {:else}
        <div class="recipes-grid">
          {#each collection.recipes as recipe}
            <RecipeCard {recipe} />
          {/each}
        </div>
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
    margin-bottom: 2rem;
  }

  .btn-back {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }

  .btn-back:hover {
    text-decoration: underline;
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

  .collection-header {
    margin-bottom: 2rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .auto-badge {
    background: var(--color-primary);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--color-text);
  }

  .description {
    color: var(--color-text-light);
    line-height: 1.6;
    margin: 0 0 0.75rem;
  }

  .meta {
    color: var(--color-text-light);
    font-weight: 600;
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

  .recipes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  @media (max-width: 640px) {
    .recipes-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
