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
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: var(--transition-slow);
    position: relative;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border-light);
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
    padding: var(--spacing-4);
  }

  .recipe-card.view-list .title-row {
    margin-bottom: 0.25rem;
  }

  .recipe-card.view-list h3 {
    font-size: 1.125rem;
  }

  .recipe-card.view-list .description {
    font-size: 0.875rem;
    margin-bottom: var(--spacing-2);
    -webkit-line-clamp: 1;
  }

  .recipe-card.view-list .meta {
    font-size: 0.813rem;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-2);
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
    padding: var(--spacing-2) var(--spacing-4);
    justify-content: center;
    gap: var(--spacing-1);
  }

  .recipe-card.view-list .btn-edit,
  .recipe-card.view-list .btn-delete {
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    font-size: 0.813rem;
  }

  .recipe-card.view-list .favorite-btn {
    width: 36px;
    height: 36px;
    top: var(--spacing-2);
    right: var(--spacing-2);
    font-size: 1.25rem;
  }

  .recipe-card.view-list .difficulty-badge {
    top: var(--spacing-2);
    left: var(--spacing-2);
    font-size: 0.688rem;
    padding: 0.25rem 0.5rem;
  }

  /* Compact View */
  .recipe-card.view-compact .image {
    height: 160px;
  }

  .recipe-card.view-compact .content {
    padding: var(--spacing-4);
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
    gap: var(--spacing-2);
  }

  .recipe-card.view-compact .tag {
    font-size: 0.688rem;
    padding: 0.25rem 0.5rem;
  }

  .recipe-card.view-compact .actions {
    padding: var(--spacing-2) var(--spacing-4);
  }

  .recipe-card.view-compact .btn-edit,
  .recipe-card.view-compact .btn-delete {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: 0.813rem;
  }

  .favorite-btn {
    position: absolute;
    top: var(--spacing-4);
    right: var(--spacing-4);
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-xl);
    cursor: pointer;
    z-index: 10;
    transition: var(--transition-normal);
    box-shadow: var(--shadow-sm);
    backdrop-filter: blur(8px);
  }

  .favorite-btn:hover {
    transform: scale(1.05);
    box-shadow: var(--shadow-md);
  }

  .favorite-btn.is-favorite {
    background: var(--color-secondary);
    color: white;
    border-color: var(--color-secondary);
  }

  .difficulty-badge {
    position: absolute;
    top: var(--spacing-4);
    left: var(--spacing-4);
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
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    border-color: var(--color-border);
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
    padding: var(--spacing-6);
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-3);
  }

  h3 {
    margin: 0;
    font-size: var(--text-xl);
    color: var(--color-text);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
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
    color: var(--color-text-secondary);
    margin: 0 0 var(--spacing-4);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    font-size: var(--text-xs);
    color: var(--color-text-light);
    margin-bottom: var(--spacing-4);
    font-weight: var(--font-medium);
  }

  .meta span {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-4);
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

  .actions {
    display: flex;
    gap: var(--spacing-3);
    padding: var(--spacing-4) var(--spacing-6) var(--spacing-6);
    border-top: 1px solid var(--color-border-light);
    margin-top: auto;
  }

  .btn-edit,
  .btn-delete {
    padding: var(--spacing-2-5) var(--spacing-4);
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    transition: var(--transition-normal);
    flex: 1;
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
    background: var(--color-surface);
    color: var(--color-error);
    border-color: var(--color-border);
  }

  .btn-delete:hover {
    background: var(--color-error);
    color: white;
    border-color: var(--color-error);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .recipe-card {
      border-radius: var(--radius-lg);
    }

    .recipe-card:hover {
      transform: none;
    }

    .image {
      height: 180px;
    }

    .image.placeholder {
      font-size: 3rem;
    }

    .content {
      padding: var(--spacing-4);
    }

    h3 {
      font-size: var(--text-lg);
    }

    .description {
      display: none;
    }

    .meta {
      gap: var(--spacing-3);
      font-size: var(--text-xs);
    }

    .tags {
      display: none;
    }

    .actions {
      display: none;
    }

    .favorite-btn {
      width: 40px;
      height: 40px;
      top: var(--spacing-3);
      right: var(--spacing-3);
    }

    .difficulty-badge {
      top: var(--spacing-3);
      left: var(--spacing-3);
      font-size: 0.625rem;
      padding: 0.25rem 0.5rem;
    }
  }
</style>
