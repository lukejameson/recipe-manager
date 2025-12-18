<script lang="ts">
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeForm from '$lib/components/RecipeForm.svelte';

  async function handleSubmit(data: any) {
    await trpc.recipe.create.mutate(data);
    goto('/');
  }

  function handleCancel() {
    goto('/');
  }
</script>

<Header />

<main>
  <div class="container">
    <h2>Create New Recipe</h2>
    <RecipeForm onSubmit={handleSubmit} onCancel={handleCancel} />
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

  h2 {
    margin: 0 0 var(--spacing-8);
    font-size: var(--text-3xl);
    color: var(--color-text);
    font-weight: var(--font-extrabold);
    letter-spacing: -0.025em;
  }
</style>
