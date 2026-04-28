<script lang="ts">
  import type { RecipeItem } from '$lib/server/db/schema';

  let { data } = $props();
  let recipe = $derived(data.recipe);

  const ingredientTexts = $derived(
    recipe?.ingredients?.items
      ?.toSorted((a: RecipeItem, b: RecipeItem) => (a.order ?? 0) - (b.order ?? 0))
      .map((i: RecipeItem) => i.text) ?? []
  );

  const instructionTexts = $derived(
    recipe?.instructions?.items
      ?.toSorted((a: RecipeItem, b: RecipeItem) => (a.order ?? 0) - (b.order ?? 0))
      .map((i: RecipeItem) => i.text) ?? []
  );

  function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
</script>

<svelte:head>
  <title>{recipe?.title ?? 'Shared Recipe'}</title>
  <meta name="description" content={recipe?.description ?? `Check out this recipe: ${recipe?.title ?? 'Shared Recipe'}`} />
  
  <meta property="og:type" content="article" />
  <meta property="og:title" content={recipe?.title ?? 'Shared Recipe'} />
  <meta property="og:description" content={recipe?.description ?? `Check out this recipe: ${recipe?.title ?? 'Shared Recipe'}`} />
  {#if recipe?.imageUrl}
    <meta property="og:image" content={recipe.imageUrl} />
    <meta property="og:image:secure_url" content={recipe.imageUrl} />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content={`Photo of ${recipe.title}`} />
  {/if}
  <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
  <meta property="og:site_name" content="Marrow Recipes" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={recipe?.title ?? 'Shared Recipe'} />
  <meta name="twitter:description" content={recipe?.description ?? `Check out this recipe: ${recipe?.title ?? 'Shared Recipe'}`} />
  {#if recipe?.imageUrl}
    <meta name="twitter:image" content={recipe.imageUrl} />
    <meta name="twitter:image:alt" content={`Photo of ${recipe.title}`} />
  {/if}

  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "Recipe",
    "name": recipe?.title,
    "description": recipe?.description,
    "image": recipe?.imageUrl,
    "prepTime": recipe?.prepTime ? `PT${recipe.prepTime}M` : undefined,
    "cookTime": recipe?.cookTime ? `PT${recipe.cookTime}M` : undefined,
    "totalTime": recipe?.totalTime ? `PT${recipe.totalTime}M` : undefined,
    "recipeYield": recipe?.servings ? `${recipe.servings} servings` : undefined,
    "recipeIngredient": ingredientTexts,
    "recipeInstructions": instructionTexts.map((text: string, i: number) => ({
      "@type": "HowToStep",
      "position": i + 1,
      "text": text
    })),
    "url": typeof window !== 'undefined' ? window.location.href : ''
  })}</script>`}
</svelte:head>

<div class="share-page">
  <article class="recipe">
    {#if recipe?.imageUrl}
      <img src={recipe.imageUrl} alt={recipe.title} class="recipe-image" />
    {/if}
    <header class="recipe-header">
      <h1>{recipe?.title}</h1>
      {#if recipe?.description}
        <p class="description">{recipe.description}</p>
      {/if}
    </header>

    <div class="meta">
      {#if recipe?.prepTime}
        <div class="meta-item">
          <span class="label">Prep Time</span>
          <span class="value">{formatTime(recipe.prepTime)}</span>
        </div>
      {/if}
      {#if recipe?.cookTime}
        <div class="meta-item">
          <span class="label">Cook Time</span>
          <span class="value">{formatTime(recipe.cookTime)}</span>
        </div>
      {/if}
      {#if recipe?.totalTime}
        <div class="meta-item">
          <span class="label">Total Time</span>
          <span class="value">{formatTime(recipe.totalTime)}</span>
        </div>
      {/if}
      {#if recipe?.servings}
        <div class="meta-item">
          <span class="label">Servings</span>
          <span class="value">{recipe.servings}</span>
        </div>
      {/if}
    </div>

    {#if recipe?.tags && recipe.tags.length > 0}
      <div class="tags">
        {#each recipe.tags as tag}
          <span class="tag">{tag}</span>
        {/each}
      </div>
    {/if}

    <section class="ingredients">
      <h2>Ingredients</h2>
      <ul>
        {#each ingredientTexts as ingredient}
          <li>{ingredient}</li>
        {/each}
      </ul>
    </section>

    <section class="instructions">
      <h2>Instructions</h2>
      <ol>
        {#each instructionTexts as instruction, i}
          <li>{instruction}</li>
        {/each}
      </ol>
    </section>

    {#if recipe?.notes}
      <section class="notes">
        <h2>Notes</h2>
        <p>{recipe.notes}</p>
      </section>
    {/if}

    {#if recipe?.nutrition && Object.keys(recipe.nutrition).length > 0}
      <section class="nutrition">
        <h2>Nutrition (per serving)</h2>
        <div class="nutrition-grid">
          {#if recipe.nutrition.calories !== undefined}
            <div class="nutrition-item">
              <span class="nutrition-value">{recipe.nutrition.calories}</span>
              <span class="nutrition-label">Calories</span>
            </div>
          {/if}
          {#if recipe.nutrition.protein !== undefined}
            <div class="nutrition-item">
              <span class="nutrition-value">{recipe.nutrition.protein}g</span>
              <span class="nutrition-label">Protein</span>
            </div>
          {/if}
          {#if recipe.nutrition.carbohydrates !== undefined}
            <div class="nutrition-item">
              <span class="nutrition-value">{recipe.nutrition.carbohydrates}g</span>
              <span class="nutrition-label">Carbs</span>
            </div>
          {/if}
          {#if recipe.nutrition.fat !== undefined}
            <div class="nutrition-item">
              <span class="nutrition-value">{recipe.nutrition.fat}g</span>
              <span class="nutrition-label">Fat</span>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    {#if recipe?.sourceUrl}
      <div class="source">
        <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
          View Original Source
        </a>
      </div>
    {/if}
  </article>
</div>

<style>
  .share-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .recipe {
    background: white;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .recipe-image {
    width: 100%;
    max-height: 400px;
    object-fit: cover;
  }

  .recipe-header {
    padding: 2rem 2rem 0;
  }

  .recipe-header h1 {
    font-size: 2rem;
    font-weight: 800;
    margin: 0 0 0.5rem;
    color: #363636;
    letter-spacing: -0.025em;
  }

  .description {
    font-size: 1.125rem;
    color: #7b6f63;
    line-height: 1.625;
    margin: 0;
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    padding: 1.5rem;
    background: #f9f5ef;
    margin: 1.5rem 2rem;
    border-radius: 12px;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meta-item .label {
    font-size: 0.75rem;
    color: #9ca3af;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .meta-item .value {
    font-weight: 600;
    color: #363636;
    font-size: 1rem;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0 2rem 1.5rem;
  }

  .tag {
    display: inline-block;
    background: #f3f4f6;
    color: #7b6f63;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid #e5e7eb;
  }

  section {
    padding: 0 2rem 2rem;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1rem;
    color: #363636;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .ingredients ul,
  .instructions ol {
    margin: 0;
    padding-left: 1.5rem;
  }

  .ingredients li,
  .instructions li {
    margin-bottom: 0.75rem;
    line-height: 1.625;
    color: #363636;
  }

  .instructions ol {
    list-style-type: decimal;
  }

  .instructions li {
    padding-left: 0.5rem;
  }

  .notes {
    background: #fefce8;
    margin: 0 2rem 2rem;
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid #fef08a;
  }

  .notes h2 {
    border: none;
    padding: 0;
    margin-bottom: 0.75rem;
    color: #854d0e;
  }

  .notes p {
    margin: 0;
    color: #713f12;
    white-space: pre-wrap;
  }

  .nutrition {
    background: #f0fdf4;
    margin: 0 2rem 2rem;
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid #bbf7d0;
  }

  .nutrition h2 {
    border: none;
    padding: 0;
    margin-bottom: 1rem;
    color: #166534;
  }

  .nutrition-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .nutrition-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .nutrition-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #166534;
  }

  .nutrition-label {
    font-size: 0.75rem;
    color: #15803d;
  }

  .source {
    padding: 1.5rem 2rem;
    border-top: 1px solid #e5e7eb;
    text-align: center;
  }

  .source a {
    color: #8c4c3e;
    text-decoration: none;
    font-weight: 500;
  }

  .source a:hover {
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .nutrition-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .recipe-header,
    section {
      padding-left: 1.5rem;
      padding-right: 1.5rem;
    }

    .meta {
      margin-left: 1.5rem;
      margin-right: 1.5rem;
    }

    .notes,
    .nutrition {
      margin-left: 1.5rem;
      margin-right: 1.5rem;
    }
  }
</style>