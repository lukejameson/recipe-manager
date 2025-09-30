<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeCard from '$lib/components/RecipeCard.svelte';

  let recipes = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let searchTerm = $state('');
  let selectedTags = $state<string[]>([]);

  onMount(() => {
    loadRecipes();
  });

  async function loadRecipes() {
    loading = true;
    error = '';
    try {
      recipes = await trpc.recipe.list.query({
        search: searchTerm || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      });
    } catch (err: any) {
      error = err.message || 'Failed to load recipes';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await trpc.recipe.delete.mutate({ id });
      recipes = recipes.filter((r) => r.id !== id);
    } catch (err: any) {
      alert('Failed to delete recipe: ' + err.message);
    }
  }

  function handleSearch() {
    loadRecipes();
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="header">
      <h2>My Recipes</h2>
      <div class="actions">
        <a href="/recipe/new" class="btn-primary">➕ New Recipe</a>
        <a href="/recipe/import" class="btn-secondary">📥 Import JSONLD</a>
      </div>
    </div>

    <div class="search-bar">
      <input
        type="search"
        bind:value={searchTerm}
        placeholder="Search recipes..."
        onkeydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button onclick={handleSearch}>Search</button>
    </div>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Loading recipes...</div>
    {:else if recipes.length === 0}
      <div class="empty">
        <p>No recipes found. Start by creating your first recipe!</p>
        <a href="/recipe/new" class="btn-primary">Create Recipe</a>
      </div>
    {:else}
      <div class="recipe-grid">
        {#each recipes as recipe (recipe.id)}
          <RecipeCard
            {recipe}
            onEdit={() => goto(`/recipe/${recipe.id}/edit`)}
            onDelete={() => handleDelete(recipe.id)}
          />
        {/each}
      </div>
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

  h2 {
    margin: 0;
    font-size: 2rem;
    color: #333;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    display: inline-block;
  }

  .btn-primary {
    background: #4a9eff;
    color: white;
  }

  .btn-primary:hover {
    background: #3a8eef;
  }

  .btn-secondary {
    background: white;
    color: #4a9eff;
    border: 1px solid #4a9eff;
  }

  .btn-secondary:hover {
    background: #e8f4ff;
  }

  .search-bar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
  }

  .search-bar input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
  }

  .search-bar input:focus {
    outline: none;
    border-color: #4a9eff;
  }

  .search-bar button {
    padding: 0.75rem 1.5rem;
    background: #4a9eff;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }

  .search-bar button:hover {
    background: #3a8eef;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 2rem;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .empty {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .empty p {
    margin-bottom: 1.5rem;
  }

  .recipe-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  @media (max-width: 640px) {
    .recipe-grid {
      grid-template-columns: 1fr;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .actions {
      flex-direction: column;
    }

    .btn-primary,
    .btn-secondary {
      text-align: center;
    }
  }
</style>
