<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeForm from '$lib/components/RecipeForm.svelte';

  let recipe = $state<any>(null);
  let loading = $state(true);
  let error = $state('');

  onMount(() => {
    loadRecipe();
  });

  async function loadRecipe() {
    loading = true;
    error = '';
    try {
      recipe = await trpc.recipe.get.query({ id: $page.params.id });
    } catch (err: any) {
      error = err.message || 'Failed to load recipe';
    } finally {
      loading = false;
    }
  }

  async function handleSubmit(data: any) {
    await trpc.recipe.update.mutate({ id: $page.params.id, data });
    goto(`/recipe/${$page.params.id}`);
  }

  function handleCancel() {
    goto(`/recipe/${$page.params.id}`);
  }
</script>

<Header />

<main>
  <div class="container">
    {#if loading}
      <div class="loading">Loading recipe...</div>
    {:else if error}
      <div class="error">{error}</div>
      <a href="/" class="btn-back">← Back to Recipes</a>
    {:else if recipe}
      <h2>Edit Recipe</h2>
      <RecipeForm recipe={recipe} onSubmit={handleSubmit} onCancel={handleCancel} />
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

  h2 {
    margin: 0 0 2rem;
    font-size: 2rem;
    color: #333;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .btn-back {
    color: #4a9eff;
    text-decoration: none;
    font-weight: 500;
  }

  .btn-back:hover {
    text-decoration: underline;
  }
</style>
