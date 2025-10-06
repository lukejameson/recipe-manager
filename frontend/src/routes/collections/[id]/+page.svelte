<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeCard from '$lib/components/RecipeCard.svelte';

  let collection = $state<any>(null);
  let allRecipes = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showAddRecipes = $state(false);

  onMount(() => {
    loadCollection();
    loadAllRecipes();
  });

  async function loadCollection() {
    loading = true;
    error = '';
    try {
      collection = await trpc.collection.get.query({ id: $page.params.id });
    } catch (err: any) {
      error = err.message || 'Failed to load collection';
    } finally {
      loading = false;
    }
  }

  async function loadAllRecipes() {
    try {
      allRecipes = await trpc.recipe.list.query();
    } catch (err: any) {
      console.error('Failed to load recipes:', err);
    }
  }

  async function handleAddRecipe(recipeId: string) {
    try {
      await trpc.collection.addRecipe.mutate({
        collectionId: $page.params.id,
        recipeId,
      });
      loadCollection();
      showAddRecipes = false;
    } catch (err: any) {
      alert('Failed to add recipe: ' + err.message);
    }
  }

  async function handleRemoveRecipe(recipeId: string) {
    if (!confirm('Remove this recipe from the collection?')) return;

    try {
      await trpc.collection.removeRecipe.mutate({
        collectionId: $page.params.id,
        recipeId,
      });
      loadCollection();
    } catch (err: any) {
      alert('Failed to remove recipe: ' + err.message);
    }
  }

  const availableRecipes = $derived(
    allRecipes.filter(
      (recipe) => !collection?.recipes?.some((r: any) => r.id === recipe.id)
    )
  );
</script>

<Header />

<main>
  <div class="container">
    <div class="header">
      <a href="/collections" class="btn-back">← Back to Collections</a>
    </div>

    {#if loading}
      <div class="loading">Loading collection...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else if collection}
      <div class="collection-header">
        <div>
          <h1>{collection.name}</h1>
          {#if collection.description}
            <p class="description">{collection.description}</p>
          {/if}
          <div class="meta">
            {collection.recipes.length} {collection.recipes.length === 1 ? 'recipe' : 'recipes'}
          </div>
        </div>
        <button onclick={() => (showAddRecipes = true)} class="btn-add">
          + Add Recipes
        </button>
      </div>

      {#if showAddRecipes}
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h2>Add Recipes to Collection</h2>
              <button onclick={() => (showAddRecipes = false)} class="btn-close">
                ✕
              </button>
            </div>

            {#if availableRecipes.length === 0}
              <div class="empty-state">
                <p>All recipes have been added to this collection!</p>
              </div>
            {:else}
              <div class="recipes-list">
                {#each availableRecipes as recipe}
                  <div class="recipe-item">
                    <div class="recipe-info">
                      {#if recipe.imageUrl}
                        <img src={recipe.imageUrl} alt={recipe.title} class="recipe-thumb" />
                      {/if}
                      <div>
                        <div class="recipe-title">{recipe.title}</div>
                        {#if recipe.description}
                          <div class="recipe-desc">{recipe.description}</div>
                        {/if}
                      </div>
                    </div>
                    <button
                      onclick={() => handleAddRecipe(recipe.id)}
                      class="btn-add-small"
                    >
                      Add
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if collection.recipes.length === 0}
        <div class="empty-state">
          <p>📝 No recipes in this collection yet</p>
          <button onclick={() => (showAddRecipes = true)} class="btn-add-large">
            Add Your First Recipe
          </button>
        </div>
      {:else}
        <div class="recipes-grid">
          {#each collection.recipes as recipe}
            <div class="recipe-wrapper">
              <RecipeCard {recipe} />
              <button
                onclick={() => handleRemoveRecipe(recipe.id)}
                class="btn-remove"
                title="Remove from collection"
              >
                Remove
              </button>
            </div>
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
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 2rem;
  }

  h1 {
    margin: 0 0 0.5rem;
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

  .btn-add {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .modal-overlay {
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

  .modal-content {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--color-text);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-text-light);
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .recipes-list {
    overflow-y: auto;
    padding: 1rem;
  }

  .recipe-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    margin-bottom: 0.75rem;
    gap: 1rem;
  }

  .recipe-info {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .recipe-thumb {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .recipe-title {
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 0.25rem;
  }

  .recipe-desc {
    font-size: 0.875rem;
    color: var(--color-text-light);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-add-small {
    padding: 0.5rem 1rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
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

  .btn-add-large {
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

  .recipes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .recipe-wrapper {
    position: relative;
  }

  .btn-remove {
    margin-top: 0.5rem;
    width: 100%;
    padding: 0.5rem;
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-remove:hover {
    background: #fee;
    color: #c33;
    border-color: #c33;
  }

  @media (max-width: 640px) {
    .collection-header {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-add {
      width: 100%;
    }

    .recipes-grid {
      grid-template-columns: 1fr;
    }

    .recipe-info {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
