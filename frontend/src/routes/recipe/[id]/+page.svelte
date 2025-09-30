<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import { formatTime, formatServings } from '$lib/utils/format';

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

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await trpc.recipe.delete.mutate({ id: $page.params.id });
      goto('/');
    } catch (err: any) {
      alert('Failed to delete recipe: ' + err.message);
    }
  }

  function handleEdit() {
    goto(`/recipe/${$page.params.id}/edit`);
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
      <div class="recipe-header">
        <a href="/" class="btn-back">← Back to Recipes</a>
        <div class="actions">
          <button onclick={handleEdit} class="btn-edit">Edit</button>
          <button onclick={handleDelete} class="btn-delete">Delete</button>
        </div>
      </div>

      <article class="recipe-detail">
        {#if recipe.imageUrl}
          <img src={recipe.imageUrl} alt={recipe.title} class="recipe-image" />
        {/if}

        <h1>{recipe.title}</h1>

        {#if recipe.description}
          <p class="description">{recipe.description}</p>
        {/if}

        <div class="meta">
          {#if recipe.prepTime}
            <div class="meta-item">
              <span class="label">⏱️ Prep Time:</span>
              <span class="value">{formatTime(recipe.prepTime)}</span>
            </div>
          {/if}
          {#if recipe.cookTime}
            <div class="meta-item">
              <span class="label">🔥 Cook Time:</span>
              <span class="value">{formatTime(recipe.cookTime)}</span>
            </div>
          {/if}
          {#if recipe.totalTime}
            <div class="meta-item">
              <span class="label">⏰ Total Time:</span>
              <span class="value">{formatTime(recipe.totalTime)}</span>
            </div>
          {/if}
          {#if recipe.servings}
            <div class="meta-item">
              <span class="label">👥 Servings:</span>
              <span class="value">{formatServings(recipe.servings)}</span>
            </div>
          {/if}
        </div>

        {#if recipe.tags && recipe.tags.length > 0}
          <div class="tags">
            {#each recipe.tags as tag}
              <span class="tag">{tag.name}</span>
            {/each}
          </div>
        {/if}

        <section class="ingredients">
          <h2>Ingredients</h2>
          <ul>
            {#each recipe.ingredients as ingredient}
              <li>{ingredient}</li>
            {/each}
          </ul>
        </section>

        <section class="instructions">
          <h2>Instructions</h2>
          <ol>
            {#each recipe.instructions as instruction}
              <li>{instruction}</li>
            {/each}
          </ol>
        </section>

        {#if recipe.sourceUrl}
          <div class="source">
            <strong>Source:</strong>
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
              {recipe.sourceUrl}
            </a>
          </div>
        {/if}
      </article>
    {/if}
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: 2rem 0;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 1rem;
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

  .recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-edit,
  .btn-delete {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    border: none;
  }

  .btn-edit {
    background: #4a9eff;
    color: white;
  }

  .btn-edit:hover {
    background: #3a8eef;
  }

  .btn-delete {
    background: #fee;
    color: #c33;
  }

  .btn-delete:hover {
    background: #fdd;
  }

  .recipe-detail {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .recipe-image {
    width: 100%;
    max-height: 400px;
    object-fit: cover;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  h1 {
    margin: 0 0 1rem;
    font-size: 2.5rem;
    color: #333;
  }

  .description {
    font-size: 1.125rem;
    line-height: 1.6;
    color: #666;
    margin-bottom: 1.5rem;
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    padding: 1.5rem;
    background: #f5f5f5;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meta-item .label {
    font-size: 0.875rem;
    color: #666;
  }

  .meta-item .value {
    font-weight: 600;
    color: #333;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 2rem;
  }

  .tag {
    background: #e8f4ff;
    color: #4a9eff;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.875rem;
  }

  section {
    margin-bottom: 2rem;
  }

  h2 {
    font-size: 1.5rem;
    margin: 0 0 1rem;
    color: #333;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #e0e0e0;
  }

  .ingredients ul,
  .instructions ol {
    margin: 0;
    padding-left: 1.5rem;
  }

  .ingredients li,
  .instructions li {
    margin-bottom: 0.75rem;
    line-height: 1.6;
  }

  .instructions li {
    padding-left: 0.5rem;
  }

  .source {
    padding-top: 1.5rem;
    border-top: 1px solid #e0e0e0;
    color: #666;
  }

  .source a {
    color: #4a9eff;
    word-break: break-all;
  }

  @media (max-width: 640px) {
    .recipe-detail {
      padding: 1.5rem;
    }

    h1 {
      font-size: 2rem;
    }

    .meta {
      grid-template-columns: 1fr;
    }

    .recipe-header {
      flex-direction: column;
      align-items: stretch;
    }

    .actions {
      justify-content: stretch;
    }

    .btn-edit,
    .btn-delete {
      flex: 1;
    }
  }
</style>
