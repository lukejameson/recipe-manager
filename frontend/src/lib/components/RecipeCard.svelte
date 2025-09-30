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
  }

  let { recipe, onEdit, onDelete }: { recipe: Recipe; onEdit?: () => void; onDelete?: () => void } = $props();
</script>

<div class="recipe-card">
  <a href="/recipe/{recipe.id}" class="card-link">
    {#if recipe.imageUrl}
      <div class="image" style="background-image: url({recipe.imageUrl})"></div>
    {:else}
      <div class="image placeholder">🍽️</div>
    {/if}

    <div class="content">
      <h3>{recipe.title}</h3>

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

    {#if recipe.tags.length > 0}
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
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
    position: relative;
    display: flex;
    flex-direction: column;
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
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .image {
    width: 100%;
    height: 200px;
    background-size: cover;
    background-position: center;
  }

  .image.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f0f0;
    font-size: 4rem;
  }

  .content {
    padding: 1rem;
  }

  h3 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: #333;
  }

  .card-link:hover h3 {
    color: #4a9eff;
  }

  .description {
    color: #666;
    margin: 0 0 0.75rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.75rem;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .tag {
    background: #e8f4ff;
    color: #4a9eff;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    padding: 0 1rem 1rem;
    border-top: 1px solid #e0e0e0;
    margin-top: auto;
  }

  .btn-edit,
  .btn-delete {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
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
</style>
