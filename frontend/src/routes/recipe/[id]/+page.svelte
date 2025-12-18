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
            <span class="icon">{recipe.isFavorite ? '★' : '☆'}</span>
            <span>Favorite</span>
          </button>
          <button onclick={toggleCookingMode} class="btn-cooking">
            <span class="icon">{cookingMode ? '📖' : '👨‍🍳'}</span>
            <span>{cookingMode ? 'View Recipe' : 'Cooking Mode'}</span>
          </button>
          <button onclick={handleEdit} class="btn-edit">
            <span class="icon">✏️</span>
            <span>Edit</span>
          </button>
          <button onclick={handleDelete} class="btn-delete">
            <span class="icon">🗑️</span>
            <span>Delete</span>
          </button>
        </div>
      </div>

      {#if cookingMode}
        <!-- Cooking Mode View -->
        <div class="cooking-mode">
          <div class="cooking-header">
            <h2>Step {currentStep + 1} of {recipe.instructions.length}</h2>
            <button onclick={handleMarkAsCooked} class="btn-mark-cooked">
              <span class="icon">✓</span>
              <span>Mark as Cooked</span>
            </button>
          </div>

          <div class="cooking-step">
            <div class="step-number">{currentStep + 1}</div>
            <p class="step-text">{recipe.instructions[currentStep]}</p>
          </div>

          <div class="cooking-navigation">
            <button onclick={prevStep} disabled={currentStep === 0} class="btn-nav">
              <span class="icon">←</span>
              <span>Previous</span>
            </button>
            <button onclick={nextStep} disabled={currentStep === recipe.instructions.length - 1} class="btn-nav">
              <span>Next</span>
              <span class="icon">→</span>
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
    padding: var(--spacing-12) 0;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 var(--spacing-6);
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
    margin-bottom: var(--spacing-8);
    flex-wrap: wrap;
    gap: var(--spacing-4);
  }

  .actions {
    display: flex;
    gap: var(--spacing-3);
  }

  .btn-edit,
  .btn-delete {
    padding: var(--spacing-2-5) var(--spacing-4);
    border-radius: var(--radius-lg);
    font-weight: var(--font-medium);
    cursor: pointer;
    border: 2px solid transparent;
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
  }

  .btn-edit {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .btn-edit:hover {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-delete {
    background: #fef2f2;
    color: var(--color-error);
    border-color: #fecaca;
  }

  .btn-delete:hover {
    background: var(--color-error);
    color: white;
    border-color: var(--color-error);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .recipe-detail {
    background: var(--color-surface);
    padding: var(--spacing-8);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border-light);
  }

  .recipe-image {
    width: 100%;
    max-height: 400px;
    object-fit: cover;
    border-radius: var(--radius-xl);
    margin-bottom: var(--spacing-6);
  }

  h1 {
    margin: 0 0 var(--spacing-4);
    font-size: var(--text-4xl);
    color: var(--color-text);
    font-weight: var(--font-extrabold);
    letter-spacing: -0.025em;
  }

  .description {
    font-size: var(--text-lg);
    line-height: var(--leading-relaxed);
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-6);
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-4);
    padding: var(--spacing-6);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .meta-item .label {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    font-weight: var(--font-medium);
  }

  .meta-item .value {
    font-weight: var(--font-semibold);
    color: var(--color-text);
    font-size: var(--text-base);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-8);
  }

  .tag {
    background: var(--color-bg-subtle);
    color: var(--color-text);
    padding: var(--spacing-1) var(--spacing-2-5);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    border: 1px solid var(--color-border);
  }

  section {
    margin-bottom: var(--spacing-8);
  }

  h2 {
    font-size: var(--text-2xl);
    margin: 0 0 var(--spacing-4);
    color: var(--color-text);
    padding-bottom: var(--spacing-2);
    border-bottom: 1px solid var(--color-border);
    font-weight: var(--font-semibold);
  }

  .ingredients ul,
  .instructions ol {
    margin: 0;
    padding-left: var(--spacing-6);
  }

  .ingredients li,
  .instructions li {
    margin-bottom: var(--spacing-3);
    line-height: var(--leading-relaxed);
    font-size: var(--text-base);
    color: var(--color-text-secondary);
  }

  .instructions li {
    padding-left: var(--spacing-2);
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
    padding: var(--spacing-2-5) var(--spacing-4);
    background: var(--color-success);
    color: white;
    border: 2px solid var(--color-success);
    border-radius: var(--radius-lg);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
  }

  .btn-mark-cooked:hover {
    background: #059669;
    border-color: #059669;
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
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
    padding: var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
  }

  .btn-nav:hover:not(:disabled) {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-nav:disabled {
    background: var(--color-border);
    border-color: var(--color-border);
    color: var(--color-text-light);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
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
    padding: var(--spacing-2-5) var(--spacing-4);
    background: var(--color-surface);
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: var(--transition-normal);
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    box-shadow: var(--shadow-xs);
  }

  .btn-favorite.is-favorite {
    background: var(--color-secondary);
    color: white;
    border-color: var(--color-secondary);
  }

  .btn-favorite:hover {
    background: var(--color-bg-subtle);
    border-color: var(--color-primary);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-favorite.is-favorite:hover {
    background: #e85a2a;
    border-color: #e85a2a;
  }

  .btn-cooking {
    padding: var(--spacing-2-5) var(--spacing-4);
    background: var(--color-accent);
    color: white;
    border: 2px solid var(--color-accent);
    border-radius: var(--radius-lg);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
  }

  .btn-cooking:hover {
    background: #20a39e;
    border-color: #20a39e;
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .scaling-section {
    background: var(--color-bg-subtle);
    padding: var(--spacing-6);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
    border: 1px solid var(--color-border-light);
  }

  .scaling-section h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-3);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .scaling-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .scaling-controls input {
    width: 80px;
    padding: var(--spacing-2);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    text-align: center;
    font-weight: var(--font-medium);
  }

  .scale-factor {
    color: var(--color-primary);
    font-weight: var(--font-semibold);
    font-size: var(--text-sm);
  }

  .rating-section {
    background: var(--color-surface);
    padding: var(--spacing-6);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    margin-top: var(--spacing-6);
    box-shadow: var(--shadow-xs);
  }

  .rating-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
  }

  .rating-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text);
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
    gap: var(--spacing-1);
    margin-bottom: var(--spacing-4);
  }

  .star-btn {
    font-size: var(--text-2xl);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-border);
    transition: var(--transition-fast);
    padding: var(--spacing-1);
  }

  .star-btn.active {
    color: var(--color-secondary);
  }

  .rating-form textarea {
    width: 100%;
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-family: inherit;
    margin-bottom: var(--spacing-4);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    resize: vertical;
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
    font-size: var(--text-xl);
    margin-bottom: var(--spacing-3);
  }

  .notes {
    color: var(--color-text-secondary);
    font-style: italic;
    margin: 0;
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    padding: var(--spacing-3);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--color-primary);
  }

  .no-rating {
    color: var(--color-text-light);
    font-style: italic;
    margin: 0;
    font-size: var(--text-sm);
  }

  .stats {
    background: var(--color-bg-subtle);
    padding: var(--spacing-4);
    border-radius: var(--radius-lg);
    margin-top: var(--spacing-6);
    color: var(--color-text-light);
    border: 1px solid var(--color-border-light);
  }

  .stats p {
    margin: var(--spacing-1) 0;
    font-size: var(--text-sm);
  }

  /* Icon styling for buttons */
  .icon {
    font-style: normal;
    line-height: 1;
  }

  @media (max-width: 640px) {
    .recipe-detail {
      padding: var(--spacing-6);
    }

    h1 {
      font-size: var(--text-3xl);
    }

    .meta {
      grid-template-columns: 1fr;
    }

    .recipe-header {
      flex-direction: column;
      align-items: stretch;
      gap: var(--spacing-4);
    }

    .actions {
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .btn-edit,
    .btn-delete,
    .btn-favorite,
    .btn-cooking {
      width: 100%;
      padding: var(--spacing-4) var(--spacing-6);
      font-size: var(--text-base);
      min-height: 52px;
      justify-content: center;
    }

    .cooking-step {
      flex-direction: column;
      padding: var(--spacing-6);
      gap: var(--spacing-4);
    }

    .step-text {
      font-size: var(--text-lg);
    }

    .cooking-navigation {
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .btn-nav {
      padding: var(--spacing-4);
      font-size: var(--text-lg);
      min-height: 52px;
    }

    .btn-mark-cooked {
      padding: var(--spacing-4) var(--spacing-6);
      font-size: var(--text-base);
      min-height: 48px;
    }

    .btn-back {
      font-size: var(--text-base);
      padding: var(--spacing-3) 0;
      margin-bottom: var(--spacing-2);
    }
  }
</style>
