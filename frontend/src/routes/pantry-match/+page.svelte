<script lang="ts">
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import AIButton from '$lib/components/ai/AIButton.svelte';
  import AIBadge from '$lib/components/ai/AIBadge.svelte';

  interface MatchedRecipe {
    recipeId: string;
    matchScore: number;
    matchedIngredients: string[];
    missingIngredients: string[];
    recipe?: {
      id: string;
      title: string;
      imageUrl?: string;
      prepTime?: number;
      cookTime?: number;
    };
  }

  let ingredientsInput = $state('');
  let loading = $state(false);
  let error = $state('');
  let matches = $state<MatchedRecipe[]>([]);
  let hasSearched = $state(false);

  async function handleSearch() {
    const ingredients = ingredientsInput
      .split(/[,\n]/)
      .map((i) => i.trim())
      .filter(Boolean);

    if (ingredients.length === 0) {
      error = 'Please enter at least one ingredient';
      return;
    }

    loading = true;
    error = '';
    matches = [];

    try {
      // First, get all recipes (we'll filter/batch on backend)
      const allRecipes = await trpc.recipe.list.query({
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        limit: 200, // Reasonable limit
      });

      if (allRecipes.recipes.length === 0) {
        error = 'No recipes found in your collection';
        loading = false;
        hasSearched = true;
        return;
      }

      // Pre-filter recipes by keyword matching (reduces AI API calls)
      const lowerIngredients = ingredients.map((i) => i.toLowerCase());
      const candidateRecipes = allRecipes.recipes
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          ingredients: r.ingredients,
          imageUrl: r.imageUrl,
          prepTime: r.prepTime,
          cookTime: r.cookTime,
          // Simple keyword match score for pre-filtering
          preScore: r.ingredients.filter((ing: string) =>
            lowerIngredients.some((li) => ing.toLowerCase().includes(li))
          ).length,
        }))
        .filter((r: any) => r.preScore > 0)
        .sort((a: any, b: any) => b.preScore - a.preScore)
        .slice(0, 50); // Top 50 candidates for AI scoring

      if (candidateRecipes.length === 0) {
        // No keyword matches, try AI on a smaller sample
        const sampleRecipes = allRecipes.recipes.slice(0, 30).map((r: any) => ({
          id: r.id,
          title: r.title,
          ingredients: r.ingredients,
          imageUrl: r.imageUrl,
          prepTime: r.prepTime,
          cookTime: r.cookTime,
        }));

        const aiMatches = await trpc.ai.findMatchingRecipes.mutate({
          availableIngredients: ingredients,
          recipes: sampleRecipes.map((r: any) => ({
            id: r.id,
            title: r.title,
            ingredients: r.ingredients,
          })),
        });

        matches = aiMatches
          .filter((m: any) => m.matchScore > 20)
          .map((m: any) => ({
            ...m,
            recipe: sampleRecipes.find((r: any) => r.id === m.recipeId),
          }));
      } else {
        // Use AI to score the pre-filtered candidates
        const aiMatches = await trpc.ai.findMatchingRecipes.mutate({
          availableIngredients: ingredients,
          recipes: candidateRecipes.map((r: any) => ({
            id: r.id,
            title: r.title,
            ingredients: r.ingredients,
          })),
        });

        matches = aiMatches
          .filter((m: any) => m.matchScore > 20)
          .map((m: any) => ({
            ...m,
            recipe: candidateRecipes.find((r: any) => r.id === m.recipeId),
          }));
      }

      hasSearched = true;
    } catch (err: any) {
      error = err.message || 'Failed to find matches';
    } finally {
      loading = false;
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'partial';
    return 'low';
  }

  function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="page-header">
      <h1>What Can I Make?</h1>
      <p class="subtitle">Enter ingredients you have and find matching recipes</p>
    </div>

    <div class="input-section">
      <label for="ingredients">Your Ingredients</label>
      <textarea
        id="ingredients"
        bind:value={ingredientsInput}
        placeholder="chicken&#10;garlic&#10;onion&#10;olive oil&#10;lemon"
        rows="6"
      ></textarea>
      <p class="hint">Enter one ingredient per line, or separate with commas</p>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <AIButton
        onclick={handleSearch}
        {loading}
        label="Find Recipes"
        loadingLabel="Searching..."
        variant="primary"
        size="md"
      />
    </div>

    {#if hasSearched}
      <div class="results-section">
        <div class="results-header">
          <h2>
            {#if matches.length > 0}
              Found {matches.length} matching recipe{matches.length !== 1 ? 's' : ''}
            {:else}
              No matches found
            {/if}
          </h2>
          <AIBadge size="md" />
        </div>

        {#if matches.length === 0}
          <p class="no-results">
            Try adding more common ingredients or check your pantry for staples like oil, salt, or garlic.
          </p>
        {:else}
          <div class="matches-list">
            {#each matches as match}
              <button class="match-card" onclick={() => goto(`/recipe/${match.recipeId}`)}>
                <div class="match-score {getScoreColor(match.matchScore)}">
                  {match.matchScore}%
                </div>

                <div class="match-content">
                  {#if match.recipe?.imageUrl}
                    <img src={match.recipe.imageUrl} alt="" class="match-image" />
                  {:else}
                    <div class="match-image-placeholder">🍽️</div>
                  {/if}

                  <div class="match-details">
                    <h3>{match.recipe?.title || 'Unknown Recipe'}</h3>

                    {#if match.recipe?.prepTime || match.recipe?.cookTime}
                      <p class="match-time">
                        {#if match.recipe.prepTime}
                          Prep: {formatTime(match.recipe.prepTime)}
                        {/if}
                        {#if match.recipe.prepTime && match.recipe.cookTime}
                          •
                        {/if}
                        {#if match.recipe.cookTime}
                          Cook: {formatTime(match.recipe.cookTime)}
                        {/if}
                      </p>
                    {/if}

                    <div class="match-ingredients">
                      <div class="matched">
                        <span class="label">Have:</span>
                        <span class="list">{match.matchedIngredients.slice(0, 5).join(', ')}{match.matchedIngredients.length > 5 ? '...' : ''}</span>
                      </div>
                      {#if match.missingIngredients.length > 0}
                        <div class="missing">
                          <span class="label">Need:</span>
                          <span class="list">{match.missingIngredients.slice(0, 3).join(', ')}{match.missingIngredients.length > 3 ? '...' : ''}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: var(--spacing-8) 0;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 var(--spacing-6);
  }

  .page-header {
    text-align: center;
    margin-bottom: var(--spacing-8);
  }

  .page-header h1 {
    font-size: var(--text-3xl);
    font-weight: 700;
    margin: 0 0 var(--spacing-2);
    color: var(--color-text);
  }

  .subtitle {
    color: var(--color-text-light);
    margin: 0;
    font-size: var(--text-lg);
  }

  .input-section {
    background: var(--color-surface);
    padding: var(--spacing-6);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
    margin-bottom: var(--spacing-8);
  }

  .input-section label {
    display: block;
    font-weight: 600;
    margin-bottom: var(--spacing-2);
    color: var(--color-text);
  }

  textarea {
    width: 100%;
    padding: var(--spacing-4);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-family: inherit;
    resize: vertical;
    margin-bottom: var(--spacing-2);
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: 0 0 var(--spacing-4);
  }

  .error {
    color: var(--color-error);
    font-size: var(--text-sm);
    margin: 0 0 var(--spacing-3);
  }

  .results-section {
    background: var(--color-surface);
    padding: var(--spacing-6);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
    padding-bottom: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
  }

  .results-header h2 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 600;
  }

  .no-results {
    text-align: center;
    color: var(--color-text-light);
    padding: var(--spacing-6);
  }

  .matches-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .match-card {
    display: flex;
    align-items: stretch;
    gap: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    cursor: pointer;
    transition: var(--transition-fast);
    text-align: left;
    width: 100%;
  }

  .match-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .match-score {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    font-size: var(--text-lg);
    font-weight: 700;
    border-radius: var(--radius-md);
    padding: var(--spacing-2);
  }

  .match-score.excellent {
    background: rgba(16, 185, 129, 0.1);
    color: var(--color-success);
  }

  .match-score.good {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .match-score.partial {
    background: rgba(245, 158, 11, 0.1);
    color: var(--color-warning);
  }

  .match-score.low {
    background: rgba(156, 163, 175, 0.1);
    color: var(--color-text-light);
  }

  .match-content {
    display: flex;
    gap: var(--spacing-4);
    flex: 1;
    min-width: 0;
  }

  .match-image {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }

  .match-image-placeholder {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    font-size: var(--text-2xl);
    flex-shrink: 0;
  }

  .match-details {
    flex: 1;
    min-width: 0;
  }

  .match-details h3 {
    margin: 0 0 var(--spacing-1);
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .match-time {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: 0 0 var(--spacing-2);
  }

  .match-ingredients {
    font-size: var(--text-xs);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .match-ingredients .label {
    font-weight: 500;
    color: var(--color-text-light);
  }

  .match-ingredients .list {
    color: var(--color-text-secondary);
  }

  .matched .list {
    color: var(--color-success);
  }

  .missing .list {
    color: var(--color-warning);
  }

  @media (max-width: 640px) {
    main {
      padding: var(--spacing-4) 0;
    }

    .container {
      padding: 0 var(--spacing-4);
    }

    .page-header h1 {
      font-size: var(--text-2xl);
    }

    .subtitle {
      font-size: var(--text-base);
    }

    .input-section,
    .results-section {
      padding: var(--spacing-4);
    }

    .match-card {
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .match-score {
      align-self: flex-start;
      min-width: auto;
      padding: var(--spacing-1) var(--spacing-3);
    }

    .match-content {
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .match-image,
    .match-image-placeholder {
      width: 100%;
      height: 120px;
    }
  }
</style>
