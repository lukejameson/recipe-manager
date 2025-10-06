<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import RelatedRecipes from '$lib/components/RelatedRecipes.svelte';
  import { formatTime, formatServings } from '$lib/utils/format';
  import { scaleRecipe } from '$lib/utils/recipe-scaling';

  let recipe = $state<any>(null);
  let loading = $state(true);
  let error = $state('');
  let cookingMode = $state(false);
  let currentStep = $state(0);
  let scaledServings = $state<number | null>(null);
  let showRatingForm = $state(false);
  let rating = $state(0);
  let notes = $state('');

  onMount(() => {
    loadRecipe();
  });

  async function loadRecipe() {
    loading = true;
    error = '';
    try {
      recipe = await trpc.recipe.get.query({ id: $page.params.id });
      scaledServings = recipe.servings;
      rating = recipe.rating || 0;
      notes = recipe.notes || '';
    } catch (err: any) {
      error = err.message || 'Failed to load recipe';
    } finally {
      loading = false;
    }
  }

  async function handleToggleFavorite() {
    try {
      await trpc.recipe.toggleFavorite.mutate({ id: $page.params.id });
      loadRecipe();
    } catch (err: any) {
      alert('Failed to toggle favorite: ' + err.message);
    }
  }

  async function handleSaveRating() {
    try {
      await trpc.recipe.updateRating.mutate({
        id: $page.params.id,
        rating: rating > 0 ? rating : undefined,
        notes: notes.trim() || undefined,
      });
      showRatingForm = false;
      loadRecipe();
    } catch (err: any) {
      alert('Failed to save rating: ' + err.message);
    }
  }

  async function handleMarkAsCooked() {
    try {
      await trpc.recipe.markAsCooked.mutate({ id: $page.params.id });
      loadRecipe();
    } catch (err: any) {
      alert('Failed to mark as cooked: ' + err.message);
    }
  }

  function toggleCookingMode() {
    cookingMode = !cookingMode;
    currentStep = 0;
  }

  function nextStep() {
    if (currentStep < (recipe?.instructions?.length || 0) - 1) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  const scaledIngredients = $derived(
    recipe && scaledServings && recipe.servings
      ? scaleRecipe(recipe.ingredients, recipe.servings, scaledServings)
      : recipe?.ingredients || []
  );

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
          <button onclick={handleToggleFavorite} class="btn-favorite" class:is-favorite={recipe.isFavorite}>
            {recipe.isFavorite ? '★' : '☆'} Favorite
          </button>
          <button onclick={toggleCookingMode} class="btn-cooking">
            {cookingMode ? '📖 View Recipe' : '👨‍🍳 Cooking Mode'}
          </button>
          <button onclick={handleEdit} class="btn-edit">✏️ Edit</button>
          <button onclick={handleDelete} class="btn-delete">🗑️ Delete</button>
        </div>
      </div>

      {#if cookingMode}
        <!-- Cooking Mode View -->
        <div class="cooking-mode">
          <div class="cooking-header">
            <h2>Step {currentStep + 1} of {recipe.instructions.length}</h2>
            <button onclick={handleMarkAsCooked} class="btn-mark-cooked">
              ✓ Mark as Cooked
            </button>
          </div>

          <div class="cooking-step">
            <div class="step-number">{currentStep + 1}</div>
            <p class="step-text">{recipe.instructions[currentStep]}</p>
          </div>

          <div class="cooking-navigation">
            <button onclick={prevStep} disabled={currentStep === 0} class="btn-nav">
              ← Previous
            </button>
            <button onclick={nextStep} disabled={currentStep === recipe.instructions.length - 1} class="btn-nav">
              Next →
            </button>
          </div>

          <div class="cooking-ingredients">
            <h3>Quick Reference - Ingredients</h3>
            <ul>
              {#each scaledIngredients as ingredient}
                <li>{ingredient}</li>
              {/each}
            </ul>
          </div>
        </div>
      {:else}

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
            {#each scaledIngredients as ingredient}
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

        <!-- Recipe Scaling -->
        {#if recipe.servings}
          <div class="scaling-section">
            <h3>Scale Recipe</h3>
            <div class="scaling-controls">
              <label for="servings">Servings:</label>
              <input
                id="servings"
                type="number"
                bind:value={scaledServings}
                min="1"
                max="99"
              />
              {#if scaledServings !== recipe.servings}
                <span class="scale-factor">
                  ({(scaledServings / recipe.servings).toFixed(1)}x)
                </span>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Rating and Notes -->
        <div class="rating-section">
          <div class="rating-header">
            <h3>My Rating & Notes</h3>
            <button onclick={() => showRatingForm = !showRatingForm} class="btn-toggle">
              {showRatingForm ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {#if showRatingForm}
            <div class="rating-form">
              <div class="star-rating">
                {#each [1, 2, 3, 4, 5] as star}
                  <button
                    class="star-btn"
                    class:active={rating >= star}
                    onclick={() => rating = star}
                  >
                    {rating >= star ? '★' : '☆'}
                  </button>
                {/each}
              </div>
              <textarea
                bind:value={notes}
                placeholder="Add your cooking notes..."
                rows="4"
              ></textarea>
              <button onclick={handleSaveRating} class="btn-save">Save</button>
            </div>
          {:else}
            <div class="rating-display">
              {#if recipe.rating}
                <div class="stars">
                  {'★'.repeat(recipe.rating)}{'☆'.repeat(5 - recipe.rating)}
                </div>
              {/if}
              {#if recipe.notes}
                <p class="notes">{recipe.notes}</p>
              {/if}
              {#if !recipe.rating && !recipe.notes}
                <p class="no-rating">No rating or notes yet</p>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Cooking Stats -->
        {#if recipe.timesCooked > 0}
          <div class="stats">
            <p>🍳 Cooked {recipe.timesCooked} time{recipe.timesCooked !== 1 ? 's' : ''}</p>
            {#if recipe.lastCookedAt}
              <p>Last cooked: {new Date(recipe.lastCookedAt).toLocaleDateString()}</p>
            {/if}
          </div>
        {/if}
      </article>

      <!-- Related Recipes -->
      {#if recipe}
        <RelatedRecipes recipeId={recipe.id} />
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

  .cooking-mode {
    background: var(--color-surface);
    padding: var(--spacing-2xl);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }

  .cooking-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xl);
  }

  .cooking-header h2 {
    margin: 0;
    color: var(--color-primary);
  }

  .btn-mark-cooked {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-success);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .cooking-step {
    background: var(--color-bg-subtle);
    padding: var(--spacing-2xl);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-xl);
    display: flex;
    gap: var(--spacing-lg);
    align-items: flex-start;
  }

  .step-number {
    font-size: 3rem;
    font-weight: 800;
    color: var(--color-primary);
    line-height: 1;
  }

  .step-text {
    font-size: 1.5rem;
    line-height: 1.6;
    margin: 0;
    flex: 1;
  }

  .cooking-navigation {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);
  }

  .btn-nav {
    flex: 1;
    padding: var(--spacing-lg);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 1.125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-nav:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .cooking-ingredients {
    background: white;
    padding: var(--spacing-lg);
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
  }

  .cooking-ingredients h3 {
    margin-top: 0;
    font-size: 1.125rem;
  }

  .cooking-ingredients ul {
    margin: 0;
    padding-left: var(--spacing-lg);
  }

  .btn-favorite {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: white;
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-favorite.is-favorite {
    background: var(--color-secondary);
    color: white;
    border-color: var(--color-secondary);
  }

  .btn-cooking {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .scaling-section {
    background: var(--color-bg-subtle);
    padding: var(--spacing-lg);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-lg);
  }

  .scaling-section h3 {
    margin-top: 0;
    font-size: 1.125rem;
  }

  .scaling-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .scaling-controls input {
    width: 80px;
    padding: var(--spacing-sm);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 1rem;
    text-align: center;
  }

  .scale-factor {
    color: var(--color-primary);
    font-weight: 600;
  }

  .rating-section {
    background: var(--color-surface);
    padding: var(--spacing-lg);
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
    margin-top: var(--spacing-lg);
  }

  .rating-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .rating-header h3 {
    margin: 0;
    font-size: 1.125rem;
  }

  .btn-toggle {
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .star-rating {
    display: flex;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }

  .star-btn {
    font-size: 2rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #ddd;
    transition: all 0.2s;
  }

  .star-btn.active {
    color: var(--color-secondary);
  }

  .rating-form textarea {
    width: 100%;
    padding: var(--spacing-md);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    margin-bottom: var(--spacing-md);
  }

  .btn-save {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .rating-display .stars {
    color: var(--color-secondary);
    font-size: 1.5rem;
    margin-bottom: var(--spacing-sm);
  }

  .notes {
    color: var(--color-text-light);
    font-style: italic;
    margin: 0;
  }

  .no-rating {
    color: var(--color-text-light);
    font-style: italic;
    margin: 0;
  }

  .stats {
    background: var(--color-bg-subtle);
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    margin-top: var(--spacing-lg);
    color: var(--color-text-light);
  }

  .stats p {
    margin: 0.25rem 0;
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
      flex-direction: column;
    }

    .btn-edit,
    .btn-delete,
    .btn-favorite,
    .btn-cooking {
      width: 100%;
    }

    .cooking-step {
      flex-direction: column;
    }

    .step-text {
      font-size: 1.25rem;
    }
  }
</style>
