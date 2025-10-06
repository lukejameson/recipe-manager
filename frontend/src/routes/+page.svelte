<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeCard from '$lib/components/RecipeCard.svelte';

  let recipes = $state<any[]>([]);
  let allTags = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let searchTerm = $state('');
  let selectedTags = $state<string[]>([]);
  let sortBy = $state<string>('date-newest');
  let viewMode = $state<'grid' | 'list' | 'compact'>('grid');

  onMount(() => {
    // Load saved preferences from localStorage
    const savedViewMode = localStorage.getItem('recipeViewMode');
    if (savedViewMode && ['grid', 'list', 'compact'].includes(savedViewMode)) {
      viewMode = savedViewMode as any;
    }

    const savedSortBy = localStorage.getItem('recipeSortBy');
    if (savedSortBy) {
      sortBy = savedSortBy;
    }

    loadTags();

    // Check for tag in URL params
    const urlTag = $page.url.searchParams.get('tag');
    if (urlTag) {
      selectedTags = [urlTag];
    }

    loadRecipes();
  });

  async function loadTags() {
    try {
      allTags = await trpc.tag.list.query();
    } catch (err: any) {
      console.error('Failed to load tags:', err);
    }
  }

  async function loadRecipes() {
    loading = true;
    error = '';
    try {
      recipes = await trpc.recipe.list.query({
        search: searchTerm || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        sortBy: sortBy as any,
      });
    } catch (err: any) {
      error = err.message || 'Failed to load recipes';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await trpc.recipe.delete.mutate({ id });
      recipes = recipes.filter((r) => r.id !== id);
    } catch (err: any) {
      alert('Failed to delete recipe: ' + err.message);
    }
  }

  async function handleToggleFavorite(id: string) {
    try {
      await trpc.recipe.toggleFavorite.mutate({ id });
      // Reload recipes to reflect the change
      loadRecipes();
    } catch (err: any) {
      alert('Failed to toggle favorite: ' + err.message);
    }
  }

  function handleSearch() {
    loadRecipes();
  }

  function toggleTag(tagName: string) {
    if (selectedTags.includes(tagName)) {
      selectedTags = selectedTags.filter(t => t !== tagName);
    } else {
      selectedTags = [...selectedTags, tagName];
    }
    loadRecipes();
  }

  function clearFilters() {
    selectedTags = [];
    searchTerm = '';
    sortBy = 'date-newest';
    loadRecipes();
  }

  function handleSortChange() {
    // Save to localStorage
    localStorage.setItem('recipeSortBy', sortBy);
    loadRecipes();
  }

  function setViewMode(mode: 'grid' | 'list' | 'compact') {
    viewMode = mode;
    // Save to localStorage
    localStorage.setItem('recipeViewMode', mode);
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="header">
      <h2>My Recipes</h2>
      <div class="actions">
        <a href="/recipe/new" class="btn-primary">➕ New Recipe</a>
        <a href="/recipe/import" class="btn-secondary">📥 Import JSONLD</a>
      </div>
    </div>

    <div class="filters-section">
      <div class="search-bar">
        <input
          type="search"
          bind:value={searchTerm}
          placeholder="Search recipes..."
          onkeydown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onclick={handleSearch} class="btn-search">Search</button>
      </div>

      <div class="controls">
        <div class="view-toggle">
          <button
            class="view-btn"
            class:active={viewMode === 'grid'}
            onclick={() => setViewMode('grid')}
            title="Grid View"
          >
            <span class="view-icon">⊞</span>
          </button>
          <button
            class="view-btn"
            class:active={viewMode === 'list'}
            onclick={() => setViewMode('list')}
            title="List View"
          >
            <span class="view-icon">☰</span>
          </button>
          <button
            class="view-btn"
            class:active={viewMode === 'compact'}
            onclick={() => setViewMode('compact')}
            title="Compact View"
          >
            <span class="view-icon">▤</span>
          </button>
        </div>

        <div class="sort-control">
          <label for="sort-select">Sort by:</label>
          <select id="sort-select" bind:value={sortBy} onchange={handleSortChange}>
            <option value="date-newest">Newest First</option>
            <option value="date-oldest">Oldest First</option>
            <option value="title-asc">Title (A-Z)</option>
            <option value="title-desc">Title (Z-A)</option>
            <option value="rating-high">Highest Rated</option>
            <option value="rating-low">Lowest Rated</option>
            <option value="cooked-most">Most Cooked</option>
            <option value="cooked-least">Least Cooked</option>
            <option value="preptime-short">Shortest Prep Time</option>
            <option value="preptime-long">Longest Prep Time</option>
            <option value="cooktime-short">Shortest Cook Time</option>
            <option value="cooktime-long">Longest Cook Time</option>
            <option value="totaltime-short">Shortest Total Time</option>
            <option value="totaltime-long">Longest Total Time</option>
          </select>
        </div>

        <a href="/tags" class="btn-tags">🏷️ Manage Tags</a>
      </div>

      {#if allTags.length > 0}
        <div class="tag-filter">
          <div class="tag-filter-header">
            <span>Filter by tags:</span>
            {#if selectedTags.length > 0}
              <button onclick={clearFilters} class="clear-btn">Clear All</button>
            {/if}
          </div>
          <div class="tag-chips">
            {#each allTags as tag (tag.id)}
              <button
                class="tag-chip {selectedTags.includes(tag.name) ? 'active' : ''}"
                onclick={() => toggleTag(tag.name)}
              >
                {tag.name}
                <span class="tag-count">({tag.recipeCount})</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if selectedTags.length > 0}
        <div class="active-filters">
          <span class="filter-label">Active filters:</span>
          {#each selectedTags as tag}
            <span class="active-tag">
              {tag}
              <button onclick={() => toggleTag(tag)} class="remove-tag">✕</button>
            </span>
          {/each}
        </div>
      {/if}
    </div>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Loading recipes...</div>
    {:else if recipes.length === 0}
      <div class="empty">
        <p>No recipes found. Start by creating your first recipe!</p>
        <a href="/recipe/new" class="btn-primary">Create Recipe</a>
      </div>
    {:else}
      <div class="recipe-grid" class:view-list={viewMode === 'list'} class:view-compact={viewMode === 'compact'}>
        {#each recipes as recipe (recipe.id)}
          <RecipeCard
            {recipe}
            {viewMode}
            onEdit={() => goto(`/recipe/${recipe.id}/edit`)}
            onDelete={() => handleDelete(recipe.id)}
            onToggleFavorite={() => handleToggleFavorite(recipe.id)}
          />
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: var(--spacing-2xl) 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-lg);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }

  h2 {
    margin: 0;
    font-size: 1.75rem;
    color: var(--color-text);
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  .actions {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--radius-md);
    text-decoration: none;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    color: white;
    border: none;
    box-shadow: var(--shadow-sm);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .btn-secondary {
    background: transparent;
    color: var(--color-primary);
    border: 1.5px solid var(--color-primary);
  }

  .btn-secondary:hover {
    background: var(--color-bg-subtle);
    transform: translateY(-1px);
  }

  .filters-section {
    margin-bottom: var(--spacing-lg);
  }

  .search-bar {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
  }

  .search-bar input {
    flex: 1;
    padding: 0.5rem var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    background: var(--color-surface);
    transition: all 0.2s;
  }

  .search-bar input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
  }

  .btn-search {
    padding: 0.5rem var(--spacing-lg);
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
  }

  .btn-search:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .controls {
    display: flex;
    gap: var(--spacing-md);
    align-items: center;
    margin-bottom: var(--spacing-md);
    flex-wrap: wrap;
  }

  .view-toggle {
    display: flex;
    gap: 0;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .view-btn {
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--color-surface);
    border: none;
    border-right: 1px solid var(--color-border);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .view-btn:last-child {
    border-right: none;
  }

  .view-btn:hover {
    background: var(--color-bg-subtle);
  }

  .view-btn.active {
    background: var(--color-primary);
    color: white;
  }

  .view-icon {
    font-size: 1.25rem;
    display: block;
  }

  .sort-control {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex: 1;
  }

  .sort-control label {
    font-weight: 500;
    color: var(--color-text);
    font-size: 0.875rem;
  }

  .sort-control select {
    padding: 0.375rem var(--spacing-sm);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.813rem;
    background: var(--color-surface);
    cursor: pointer;
    transition: all 0.2s;
  }

  .sort-control select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
  }

  .btn-tags {
    padding: 0.375rem var(--spacing-sm);
    background: transparent;
    color: var(--color-primary);
    border: 1.5px solid var(--color-primary);
    border-radius: var(--radius-md);
    text-decoration: none;
    font-weight: 600;
    transition: all 0.2s;
    white-space: nowrap;
    font-size: 0.813rem;
  }

  .btn-tags:hover {
    background: var(--color-bg-subtle);
  }

  .tag-filter {
    background: var(--color-surface);
    padding: var(--spacing-sm);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-sm);
  }

  .tag-filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
    font-weight: 500;
    color: var(--color-text);
    font-size: 0.875rem;
  }

  .clear-btn {
    padding: 0.25rem var(--spacing-sm);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .clear-btn:hover {
    background: var(--color-secondary);
  }

  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .tag-chip {
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-subtle);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.2s;
    color: var(--color-text);
  }

  .tag-chip:hover {
    border-color: var(--color-primary);
    background: var(--color-surface);
  }

  .tag-chip.active {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    color: white;
    border-color: var(--color-primary);
  }

  .tag-count {
    opacity: 0.7;
    font-size: 0.688rem;
  }

  .active-filters {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
    padding: var(--spacing-sm);
    background: #e0f2fe;
    border-radius: var(--radius-md);
  }

  .filter-label {
    font-weight: 600;
    color: #0369a1;
    font-size: 0.813rem;
  }

  .active-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: white;
    border: 1px solid #0284c7;
    border-radius: var(--radius-sm);
    color: #0369a1;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .remove-tag {
    background: none;
    border: none;
    cursor: pointer;
    color: #0369a1;
    font-size: 0.875rem;
    padding: 0;
    line-height: 1;
  }

  .remove-tag:hover {
    color: #dc2626;
  }

  .error {
    background: #ffe5e5;
    color: var(--color-error);
    padding: var(--spacing-lg);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-xl);
    border-left: 4px solid var(--color-error);
    font-weight: 500;
  }

  .loading {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--color-text-light);
    font-size: 1.125rem;
  }

  .empty {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--color-text-light);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .empty p {
    margin-bottom: var(--spacing-lg);
    font-size: 1.125rem;
  }

  .recipe-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--spacing-xl);
    animation: fadeIn 0.4s ease-out;
  }

  .recipe-grid.view-list {
    grid-template-columns: 1fr;
    gap: var(--spacing-sm);
  }

  .recipe-grid.view-compact {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--spacing-md);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 640px) {
    main {
      padding: var(--spacing-lg) 0;
    }

    .container {
      padding: 0 var(--spacing-md);
    }

    .header {
      margin-bottom: var(--spacing-lg);
      gap: var(--spacing-md);
    }

    h2 {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .actions {
      flex-direction: column;
      width: 100%;
      gap: var(--spacing-sm);
    }

    .btn-primary,
    .btn-secondary {
      width: 100%;
      text-align: center;
      justify-content: center;
      padding: var(--spacing-md);
      font-size: 1rem;
      min-height: 48px;
    }

    .filters-section {
      margin-bottom: var(--spacing-lg);
    }

    .search-bar {
      margin-bottom: var(--spacing-md);
    }

    .search-bar input {
      font-size: 1rem;
      padding: var(--spacing-md);
      min-height: 48px;
    }

    .btn-search {
      padding: var(--spacing-md) var(--spacing-lg);
      font-size: 1rem;
      min-height: 48px;
    }

    .controls {
      flex-direction: column;
      align-items: stretch;
      margin-bottom: var(--spacing-md);
      gap: var(--spacing-sm);
    }

    .sort-control {
      width: 100%;
      gap: var(--spacing-sm);
    }

    .sort-control label {
      font-size: 0.938rem;
      flex-shrink: 0;
    }

    .sort-control select {
      flex: 1;
      font-size: 0.938rem;
      padding: var(--spacing-sm) var(--spacing-md);
      min-height: 44px;
    }

    .btn-tags {
      font-size: 0.938rem;
      padding: var(--spacing-sm) var(--spacing-md);
      min-height: 44px;
      text-align: center;
    }

    .tag-filter {
      padding: var(--spacing-md);
    }

    .tag-filter-header {
      font-size: 0.938rem;
      margin-bottom: var(--spacing-md);
    }

    .clear-btn {
      font-size: 0.875rem;
      padding: var(--spacing-xs) var(--spacing-md);
      min-height: 36px;
    }

    .tag-chips {
      gap: var(--spacing-sm);
    }

    .tag-chip {
      font-size: 0.875rem;
      padding: var(--spacing-sm) var(--spacing-md);
      min-height: 40px;
    }

    .tag-count {
      font-size: 0.813rem;
    }

    .active-filters {
      padding: var(--spacing-md);
      gap: var(--spacing-sm);
    }

    .filter-label {
      font-size: 0.938rem;
    }

    .active-tag {
      font-size: 0.875rem;
      padding: var(--spacing-xs) var(--spacing-md);
      min-height: 36px;
    }

    .recipe-grid {
      grid-template-columns: 1fr !important;
      gap: var(--spacing-lg);
    }

    .view-toggle {
      order: -1;
      width: 100%;
    }

    .view-btn {
      flex: 1;
    }
  }
</style>
