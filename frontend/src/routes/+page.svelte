<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Header from '$lib/components/Header.svelte';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import { trpc } from '$lib/trpc/client';
  import { onMount } from 'svelte';

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
      recipes = recipes.filter(r => r.id !== id);
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
      <a href="/recipe/new" class="btn-primary mobile-fab">
        <span class="btn-text">New</span>
      </a>
    </div>

    <div class="filters-section">
      <div class="search-bar">
        <input
          type="search"
          bind:value={searchTerm}
          placeholder="Search recipes..."
          onkeydown={e => e.key === 'Enter' && handleSearch()}
        />
        <button onclick={handleSearch} class="btn-search">Search</button>
      </div>

      <div class="controls">
        <div class="view-toggle desktop-only">
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
          <select
            id="sort-select"
            bind:value={sortBy}
            onchange={handleSortChange}
          >
            <option value="date-newest">Newest</option>
            <option value="date-oldest">Oldest</option>
            <option value="title-asc">A-Z</option>
            <option value="title-desc">Z-A</option>
            <option value="rating-high">Top Rated</option>
            <option value="cooked-most">Most Cooked</option>
          </select>
        </div>

        <a href="/tags" class="btn-tags desktop-only">
          <span class="icon">🏷️</span>
          <span>Manage Tags</span>
        </a>
      </div>

      {#if selectedTags.length > 0}
        <div class="active-filters">
          <span class="filter-label">Filters:</span>
          {#each selectedTags as tag}
            <span class="active-tag">
              {tag}
              <button onclick={() => toggleTag(tag)} class="remove-tag"
                >✕</button
              >
            </span>
          {/each}
          <button onclick={clearFilters} class="clear-btn">Clear</button>
        </div>
      {/if}

      {#if allTags.length > 0}
        <details class="tag-filter-collapsible">
          <summary class="tag-filter-toggle">
            <span>🏷️ Filter by tag</span>
            <span class="tag-count-badge">{allTags.length}</span>
          </summary>
          <div class="tag-chips">
            {#each allTags as tag (tag.id)}
              <button
                class="tag-chip {selectedTags.includes(tag.name)
                  ? 'active'
                  : ''}"
                onclick={() => toggleTag(tag.name)}
              >
                {tag.name}
                <span class="tag-count">({tag.recipeCount})</span>
              </button>
            {/each}
          </div>
        </details>
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
      <div
        class="recipe-grid"
        class:view-list={viewMode === 'list'}
        class:view-compact={viewMode === 'compact'}
      >
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
    padding: var(--spacing-6) 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-4);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-5);
  }

  h2 {
    margin: 0;
    font-size: var(--text-2xl);
    color: var(--color-text);
    font-weight: var(--font-bold);
  }

  .btn-primary {
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--radius-lg);
    text-decoration: none;
    font-weight: var(--font-semibold);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
    font-size: var(--text-sm);
    background: var(--color-primary);
    color: white;
    border: none;
  }

  .btn-primary:hover {
    background: var(--color-primary-dark);
  }

  .filters-section {
    margin-bottom: var(--spacing-5);
  }

  .search-bar {
    display: flex;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-4);
  }

  .search-bar input {
    flex: 1;
    padding: var(--spacing-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    background: var(--color-surface);
  }

  .search-bar input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .btn-search {
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
  }

  .controls {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
    margin-bottom: var(--spacing-4);
  }

  .view-toggle {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .view-btn {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-surface);
    border: none;
    border-right: 1px solid var(--color-border);
    cursor: pointer;
    color: var(--color-text-light);
  }

  .view-btn:last-child {
    border-right: none;
  }

  .view-btn.active {
    background: var(--color-primary);
    color: white;
  }

  .view-icon {
    font-size: 1rem;
  }

  .sort-control {
    flex: 1;
  }

  .sort-control select {
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    background: var(--color-surface);
    color: var(--color-text);
  }

  .btn-tags {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-surface);
    color: var(--color-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  /* Collapsible tag filter */
  .tag-filter-collapsible {
    margin-bottom: var(--spacing-4);
  }

  .tag-filter-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text);
    list-style: none;
  }

  .tag-filter-toggle::-webkit-details-marker {
    display: none;
  }

  .tag-count-badge {
    background: var(--color-bg-subtle);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .tag-filter-collapsible[open] .tag-filter-toggle {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom: none;
  }

  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-top: none;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  .tag-chip {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    cursor: pointer;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text);
  }

  .tag-chip.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .tag-count {
    opacity: 0.7;
  }

  .active-filters {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    flex-wrap: wrap;
    padding: var(--spacing-3);
    background: #e0f2fe;
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-4);
  }

  .filter-label {
    font-weight: var(--font-semibold);
    color: #0369a1;
    font-size: var(--text-sm);
  }

  .active-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-1) var(--spacing-2);
    background: white;
    border: 1px solid #0284c7;
    border-radius: var(--radius-sm);
    color: #0369a1;
    font-size: var(--text-xs);
  }

  .remove-tag {
    background: none;
    border: none;
    cursor: pointer;
    color: #0369a1;
    padding: 0;
    line-height: 1;
  }

  .clear-btn {
    padding: var(--spacing-1) var(--spacing-2);
    background: #0284c7;
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    margin-left: auto;
  }

  .desktop-only {
    display: flex;
  }

  .error {
    background: #ffe5e5;
    color: var(--color-error);
    padding: var(--spacing-4);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
    border-left: 4px solid var(--color-error);
    font-weight: 500;
  }

  .loading {
    text-align: center;
    padding: var(--spacing-12);
    color: var(--color-text-light);
    font-size: var(--text-lg);
  }

  .empty {
    text-align: center;
    padding: var(--spacing-12);
    color: var(--color-text-secondary);
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xs);
    border: 1px solid var(--color-border-light);
  }

  .empty p {
    margin-bottom: var(--spacing-6);
    font-size: var(--text-lg);
  }

  .recipe-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--spacing-6);
    animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .recipe-grid.view-list {
    grid-template-columns: 1fr;
    gap: var(--spacing-3);
  }

  .recipe-grid.view-compact {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--spacing-4);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Mobile styles */
  @media (max-width: 640px) {
    main {
      padding: var(--spacing-4) 0;
    }

    .header {
      margin-bottom: var(--spacing-4);
    }

    h2 {
      font-size: var(--text-xl);
    }

    .btn-primary .btn-text {
      display: none;
    }

    .btn-primary {
      padding: var(--spacing-3);
      border-radius: var(--radius-full);
    }

    .search-bar input {
      padding: var(--spacing-3);
      font-size: 16px; /* Prevents zoom on iOS */
    }

    .btn-search {
      padding: var(--spacing-3);
    }

    .desktop-only {
      display: none !important;
    }

    .sort-control select {
      padding: var(--spacing-3);
      font-size: 16px;
    }

    .tag-chip {
      padding: var(--spacing-2) var(--spacing-3);
      min-height: 44px;
      display: flex;
      align-items: center;
    }

    .recipe-grid {
      grid-template-columns: 1fr !important;
      gap: var(--spacing-4);
    }
  }

  .icon {
    font-style: normal;
    line-height: 1;
  }
</style>
