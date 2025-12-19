<script lang="ts">
  import { trpc } from '$lib/trpc/client';

  let {
    onAdd,
    onClose,
    excludeRecipeIds = [],
  }: {
    onAdd: (recipe: any, servings: number) => void;
    onClose: () => void;
    excludeRecipeIds?: string[];
  } = $props();

  let recipes = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let selectedRecipe = $state<any>(null);
  let servingsNeeded = $state(1);

  $effect(() => {
    loadRecipes();
  });

  async function loadRecipes() {
    loading = true;
    error = '';
    try {
      const allRecipes = await trpc.recipe.list.query({});
      // Filter out excluded recipes
      recipes = allRecipes.filter((r: any) => !excludeRecipeIds.includes(r.id));
    } catch (err: any) {
      error = err.message || 'Failed to load recipes';
    } finally {
      loading = false;
    }
  }

  const filteredRecipes = $derived(
    recipes.filter((r) =>
      r.title.toLowerCase().includes(search.toLowerCase())
    )
  );

  function handleSelect(recipe: any) {
    selectedRecipe = recipe;
    servingsNeeded = recipe.servings || 1;
  }

  function handleAdd() {
    if (selectedRecipe) {
      onAdd(selectedRecipe, servingsNeeded);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h3>Add Component Recipe</h3>
      <button class="btn-close" onclick={onClose}>&times;</button>
    </div>

    <div class="modal-body">
      {#if error}
        <div class="error">{error}</div>
      {/if}

      <div class="search-box">
        <input
          type="text"
          bind:value={search}
          placeholder="Search recipes..."
          autofocus
        />
      </div>

      {#if loading}
        <div class="loading">Loading recipes...</div>
      {:else if filteredRecipes.length === 0}
        <div class="empty">
          {#if search}
            No recipes found matching "{search}"
          {:else}
            No available recipes to add
          {/if}
        </div>
      {:else}
        <div class="recipe-list">
          {#each filteredRecipes as recipe}
            <button
              class="recipe-item"
              class:selected={selectedRecipe?.id === recipe.id}
              onclick={() => handleSelect(recipe)}
            >
              <div class="recipe-info">
                <span class="recipe-title">{recipe.title}</span>
                {#if recipe.servings}
                  <span class="recipe-servings">{recipe.servings} servings</span>
                {/if}
              </div>
              {#if recipe.tags?.length > 0}
                <div class="recipe-tags">
                  {#each recipe.tags.slice(0, 3) as tag}
                    <span class="tag">{tag.name}</span>
                  {/each}
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}

      {#if selectedRecipe}
        <div class="servings-input">
          <label for="servings">Servings needed:</label>
          <input
            id="servings"
            type="number"
            bind:value={servingsNeeded}
            min="0.1"
            step="0.5"
          />
          {#if selectedRecipe.servings && servingsNeeded !== selectedRecipe.servings}
            <span class="scale-note">
              ({(servingsNeeded / selectedRecipe.servings).toFixed(2)}x of recipe)
            </span>
          {/if}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" onclick={onClose}>Cancel</button>
      <button
        class="btn-primary"
        disabled={!selectedRecipe}
        onclick={handleAdd}
      >
        Add Component
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-4);
  }

  .modal {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4) var(--spacing-6);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: var(--text-2xl);
    color: var(--color-text-light);
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .btn-close:hover {
    color: var(--color-text);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4) var(--spacing-6);
  }

  .error {
    background: #fef2f2;
    color: var(--color-error);
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-4);
    font-size: var(--text-sm);
  }

  .search-box {
    margin-bottom: var(--spacing-4);
  }

  .search-box input {
    width: 100%;
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    background: var(--color-surface);
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .loading,
  .empty {
    text-align: center;
    padding: var(--spacing-8);
    color: var(--color-text-light);
  }

  .recipe-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    max-height: 300px;
    overflow-y: auto;
  }

  .recipe-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-1);
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    cursor: pointer;
    transition: var(--transition-fast);
    text-align: left;
    width: 100%;
  }

  .recipe-item:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-subtle);
  }

  .recipe-item.selected {
    border-color: var(--color-primary);
    background: rgba(255, 107, 53, 0.1);
  }

  .recipe-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: var(--spacing-2);
  }

  .recipe-title {
    font-weight: var(--font-medium);
    color: var(--color-text);
  }

  .recipe-servings {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .recipe-tags {
    display: flex;
    gap: var(--spacing-1);
    flex-wrap: wrap;
  }

  .tag {
    font-size: var(--text-xs);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-full);
    color: var(--color-text-light);
  }

  .servings-input {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    margin-top: var(--spacing-4);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-lg);
  }

  .servings-input label {
    font-weight: var(--font-medium);
    white-space: nowrap;
  }

  .servings-input input {
    width: 80px;
    padding: var(--spacing-2);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    text-align: center;
  }

  .scale-note {
    font-size: var(--text-sm);
    color: var(--color-primary);
    font-weight: var(--font-medium);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-3);
    padding: var(--spacing-4) var(--spacing-6);
    border-top: 1px solid var(--color-border);
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    border: 2px solid transparent;
    transition: var(--transition-fast);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
  }

  .btn-primary:disabled {
    background: var(--color-border);
    border-color: var(--color-border);
    color: var(--color-text-light);
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border-color: var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-bg-subtle);
  }

  @media (max-width: 640px) {
    .modal {
      max-height: 90vh;
    }

    .servings-input {
      flex-wrap: wrap;
    }
  }
</style>
