<script lang="ts">
  import { formatTime, formatServings } from '$lib/utils/format';

  interface Recipe {
    id: string;
    title: string;
    description: string | null;
    prepTime: number | null;
    cookTime: number | null;
    servings: number | null;
    imageUrl: string | null;
    tags: { id: string; name: string }[];
    isFavorite?: boolean;
    rating?: number | null;
    difficulty?: string | null;
  }

  let { recipe, viewMode = 'grid', onEdit, onDelete, onToggleFavorite }: {
    recipe: Recipe;
    viewMode?: 'grid' | 'list' | 'compact';
    onEdit?: () => void;
    onDelete?: () => void;
    onToggleFavorite?: () => void;
  } = $props();
</script>

<div class="recipe-card" class:view-list={viewMode === 'list'} class:view-compact={viewMode === 'compact'}>
  {#if onToggleFavorite}
    <button
      class="favorite-btn"
      class:is-favorite={recipe.isFavorite}
      onclick={(e) => { e.preventDefault(); onToggleFavorite?.(); }}
      aria-label="Toggle favorite"
    >
      {recipe.isFavorite ? '★' : '☆'}
    </button>
  {/if}

  {#if recipe.difficulty}
    <span class="difficulty-badge {recipe.difficulty}">{recipe.difficulty}</span>
  {/if}

  <a href="/recipe/{recipe.id}" class="card-link">
    {#if recipe.imageUrl}
      <div class="image" style="background-image: url({recipe.imageUrl})"></div>
    {:else}
      <div class="image placeholder">🍽️</div>
    {/if}

    <div class="content">
      <div class="title-row">
        <h3>{recipe.title}</h3>
        {#if recipe.rating}
          <span class="rating">{'★'.repeat(recipe.rating)}{'☆'.repeat(5 - recipe.rating)}</span>
        {/if}
      </div>

    {#if recipe.description}
      <p class="description">{recipe.description}</p>
    {/if}

    <div class="meta">
      {#if recipe.prepTime}
        <span>⏱️ Prep: {formatTime(recipe.prepTime)}</span>
      {/if}
      {#if recipe.cookTime}
        <span>🔥 Cook: {formatTime(recipe.cookTime)}</span>
      {/if}
      {#if recipe.servings}
        <span>👥 {formatServings(recipe.servings)}</span>
      {/if}
    </div>

    {#if recipe.tags?.length > 0}
      <div class="tags">
        {#each recipe.tags as tag}
          <span class="tag">{tag.name}</span>
        {/each}
      </div>
    {/if}
    </div>
  </a>

  {#if onEdit || onDelete}
    <div class="actions">
      {#if onEdit}
        <button onclick={onEdit} class="btn-edit">Edit</button>
      {/if}
      {#if onDelete}
        <button onclick={onDelete} class="btn-delete">Delete</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .recipe-card {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--color-border);
  }

  /* List View */
  .recipe-card.view-list {
    flex-direction: row;
    align-items: center;
  }

  .recipe-card.view-list .image {
    width: 140px;
    height: 140px;
    min-height: auto;
    flex-shrink: 0;
  }

  .recipe-card.view-list .image::after {
    display: none;
  }

  .recipe-card.view-list .card-link {
    flex-direction: row;
    flex: 1;
    align-items: center;
  }

  .recipe-card.view-list .content {
    flex: 1;
    padding: var(--spacing-md);
  }

  .recipe-card.view-list .title-row {
    margin-bottom: 0.25rem;
  }

  .recipe-card.view-list h3 {
    font-size: 1.125rem;
  }

  .recipe-card.view-list .description {
    font-size: 0.875rem;
    margin-bottom: var(--spacing-sm);
    -webkit-line-clamp: 1;
  }

  .recipe-card.view-list .meta {
    font-size: 0.813rem;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .recipe-card.view-list .tags {
    margin-bottom: 0;
  }

  .recipe-card.view-list .tag {
    font-size: 0.688rem;
    padding: 0.25rem 0.5rem;
  }

  .recipe-card.view-list .actions {
    border-top: none;
    border-left: 2px solid var(--color-border);
    flex-direction: column;
    padding: var(--spacing-sm) var(--spacing-md);
    justify-content: center;
    gap: var(--spacing-xs);
  }

  .recipe-card.view-list .btn-edit,
  .recipe-card.view-list .btn-delete {
    width: 100%;
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.813rem;
  }

  .recipe-card.view-list .favorite-btn {
    width: 36px;
    height: 36px;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    font-size: 1.25rem;
  }

  .recipe-card.view-list .difficulty-badge {
    top: var(--spacing-sm);
    left: var(--spacing-sm);
    font-size: 0.688rem;
    padding: 0.25rem 0.5rem;
  }

  /* Compact View */
  .recipe-card.view-compact .image {
    height: 160px;
  }

  .recipe-card.view-compact .content {
    padding: var(--spacing-md);
  }

  .recipe-card.view-compact h3 {
    font-size: 1.125rem;
  }

  .recipe-card.view-compact .description {
    font-size: 0.875rem;
    -webkit-line-clamp: 1;
  }

  .recipe-card.view-compact .meta {
    font-size: 0.813rem;
    gap: var(--spacing-sm);
  }

  .recipe-card.view-compact .tag {
    font-size: 0.688rem;
    padding: 0.25rem 0.5rem;
  }

  .recipe-card.view-compact .actions {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .recipe-card.view-compact .btn-edit,
  .recipe-card.view-compact .btn-delete {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.813rem;
  }

  .favorite-btn {
    position: absolute;
    top: var(--spacing-md);
    right: var(--spacing-md);
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid var(--color-border);
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s;
    box-shadow: var(--shadow-md);
  }

  .favorite-btn:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-lg);
  }

  .favorite-btn.is-favorite {
    background: var(--color-secondary);
    color: white;
    border-color: var(--color-secondary);
  }

  .difficulty-badge {
    position: absolute;
    top: var(--spacing-md);
    left: var(--spacing-md);
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-xl);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    z-index: 10;
    box-shadow: var(--shadow-sm);
  }

  .difficulty-badge.easy {
    background: var(--color-success);
    color: white;
  }

  .difficulty-badge.medium {
    background: var(--color-warning);
    color: var(--color-text);
  }

  .difficulty-badge.hard {
    background: var(--color-error);
    color: white;
  }

  .card-link {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .recipe-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-xl);
    border-color: var(--color-primary-light);
  }

  .image {
    width: 100%;
    height: 220px;
    background-size: cover;
    background-position: center;
    position: relative;
  }

  .image::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(to top, rgba(0,0,0,0.3), transparent);
  }

  .image.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-bg-subtle) 0%, var(--color-border) 100%);
    font-size: 5rem;
  }

  .content {
    padding: var(--spacing-lg);
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  h3 {
    margin: 0;
    font-size: 1.375rem;
    color: var(--color-text);
    font-weight: 700;
    line-height: 1.3;
    flex: 1;
  }

  .card-link:hover h3 {
    color: var(--color-primary);
  }

  .rating {
    color: var(--color-secondary);
    font-size: 1rem;
    white-space: nowrap;
  }

  .description {
    color: var(--color-text-light);
    margin: 0 0 var(--spacing-md);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    font-size: 0.875rem;
    color: var(--color-text-light);
    margin-bottom: var(--spacing-md);
    font-weight: 500;
  }

  .meta span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }

  .tag {
    background: linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-secondary) 100%);
    color: white;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-xl);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: var(--shadow-sm);
  }

  .actions {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
    border-top: 2px solid var(--color-border);
    margin-top: auto;
  }

  .btn-edit,
  .btn-delete {
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s;
    flex: 1;
  }

  .btn-edit {
    background: var(--color-primary);
    color: white;
  }

  .btn-edit:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .btn-delete {
    background: var(--color-bg-subtle);
    color: var(--color-error);
    border: 2px solid var(--color-border);
  }

  .btn-delete:hover {
    background: var(--color-error);
    color: white;
    border-color: var(--color-error);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
</style>
