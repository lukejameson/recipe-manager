<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import RecipeCard from './RecipeCard.svelte';

  let { recipeId } = $props<{ recipeId: string }>();

  let relatedRecipes = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      relatedRecipes = await trpc.recipe.getRelated.query({ id: recipeId, limit: 6 });
    } catch (err) {
      console.error('Failed to load related recipes:', err);
    } finally {
      loading = false;
    }
  });

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await trpc.recipe.delete.mutate({ id });
      relatedRecipes = relatedRecipes.filter((r) => r.id !== id);
    } catch (err: any) {
      alert('Failed to delete recipe: ' + err.message);
    }
  }

  async function handleToggleFavorite(id: string) {
    try {
      await trpc.recipe.toggleFavorite.mutate({ id });
      // Reload the related recipe
      const index = relatedRecipes.findIndex(r => r.id === id);
      if (index !== -1) {
        const updated = await trpc.recipe.get.query({ id });
        relatedRecipes[index] = updated;
      }
    } catch (err: any) {
      alert('Failed to toggle favorite: ' + err.message);
    }
  }
</script>

{#if !loading && relatedRecipes.length > 0}
  <div class="related-recipes">
    <h3>Related Recipes</h3>
    <p class="description">Other recipes you might enjoy based on shared tags</p>

    <div class="recipe-grid">
      {#each relatedRecipes as recipe (recipe.id)}
        <RecipeCard
          {recipe}
          onEdit={() => goto(`/recipe/${recipe.id}/edit`)}
          onDelete={() => handleDelete(recipe.id)}
          onToggleFavorite={() => handleToggleFavorite(recipe.id)}
        />
      {/each}
    </div>
  </div>
{/if}

<style>
  .related-recipes {
    margin-top: var(--spacing-12);
    padding-top: var(--spacing-12);
    border-top: 2px solid var(--color-border);
  }

  h3 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 var(--spacing-2) 0;
  }

  .description {
    color: var(--color-text-light);
    margin-bottom: var(--spacing-6);
    font-size: 1rem;
  }

  .recipe-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--spacing-6);
    animation: fadeIn 0.6s ease-out;
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

  @media (max-width: 640px) {
    .recipe-grid {
      grid-template-columns: 1fr;
    }

    h3 {
      font-size: 1.5rem;
    }
  }
</style>
