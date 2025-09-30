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
</style>
