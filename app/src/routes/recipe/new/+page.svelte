<script lang="ts">
  import { goto } from '$app/navigation';
  import { apiClient } from '$lib/api/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeForm from '$lib/components/RecipeForm.svelte';

  async function handleSubmit(data: any) {
    const { components, ...recipeData } = data;

    // Create the recipe
    const newRecipe = await apiClient.createRecipe(recipeData);

    // Set components if any
    if (components && components.length > 0) {
      await apiClient.setComponents(newRecipe.id, components);
    }

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
    padding: var(--spacing-6) 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-6);
  }

  h2 {
    margin: 0 0 var(--spacing-5);
    font-size: var(--text-2xl);
    color: var(--color-text);
    font-weight: var(--font-bold);
    letter-spacing: -0.025em;
  }

  @media (max-width: 640px) {
    main {
      padding: var(--spacing-4) 0;
    }

    .container {
      padding: 0 var(--spacing-4);
    }

    h2 {
      font-size: var(--text-xl);
      margin-bottom: var(--spacing-4);
    }
  }
</style>
