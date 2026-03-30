<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiClient } from '$lib/api/client';
  import Header from '$lib/components/Header.svelte';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import {
    Camera,
    Flame,
    LayoutGrid,
    List,
    PanelTop,
    Plus,
    Search,
    SlidersHorizontal,
    Tag,
    Wine,
    ArrowDownUp,
    X,
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte';

  let recipes = $state<any[]>([]);
  let allTags = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let searchTerm = $state('');
  let selectedTags = $state<string[]>([]);
  let sortBy = $state<string>('date-newest');
  let viewMode = $state<'grid' | 'list' | 'compact'>('grid');
  let category = $state<'all' | 'food' | 'cocktails'>('all');

  // Mobile filter/sort sheets
  let showMobileSort = $state(false);
  let showMobileFilter = $state(false);

  // Desktop dropdowns
  let showViewDropdown = $state(false);
  let showSortDropdown = $state(false);
  let showFilterDropdown = $state(false);

  // Feature flags
  let hasPhotoExtraction = $derived(authStore.hasFeature('photoExtraction'));

  // Photo upload
  let photoInputRef = $state<HTMLInputElement | null>(null);

  // Tags that indicate a recipe is a drink/cocktail
  const drinkTags = [
    'cocktail',
    'mocktail',
    'drink',
    'beverage',
    'cocktails',
    'drinks',
  ];

  const sortOptions = [
    { value: 'date-newest', label: 'Newest' },
    { value: 'date-oldest', label: 'Oldest' },
    { value: 'title-asc', label: 'A-Z' },
    { value: 'title-desc', label: 'Z-A' },
    { value: 'rating-high', label: 'Top Rated' },
    { value: 'cooked-most', label: 'Most Cooked' },
  ];

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

    const savedCategory = localStorage.getItem('recipeCategory');
    if (savedCategory && ['all', 'food', 'cocktails'].includes(savedCategory)) {
      category = savedCategory as any;
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
      allTags = await apiClient.getTags();
    } catch (err: any) {
      console.error('Failed to load tags:', err);
    }
  }

  async function loadRecipes() {
    loading = true;
    error = '';
    try {
      let allRecipes = await apiClient.getRecipes({
        search: searchTerm || undefined,
        sortBy: sortBy as any,
      });

      // Filter by tags if any selected
      if (selectedTags.length > 0) {
        allRecipes = allRecipes.filter((r: any) =>
          r.tags?.some((t: any) => selectedTags.includes(t.name || t))
        );
      }

      // Filter by category based on drink-related tags
      if (category === 'cocktails') {
        recipes = allRecipes.filter((r: any) =>
          r.tags?.some((t: any) =>
            drinkTags.includes((t.name || t).toLowerCase())
          )
        );
      } else if (category === 'food') {
        recipes = allRecipes.filter(
          (r: any) =>
            !r.tags?.some((t: any) =>
              drinkTags.includes((t.name || t).toLowerCase())
            )
        );
      } else {
        recipes = allRecipes;
      }
    } catch (err: any) {
      error = err.message || 'Failed to load recipes';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await apiClient.deleteRecipe(id);
      recipes = recipes.filter(r => r.id !== id);
    } catch (err: any) {
      alert('Failed to delete recipe: ' + err.message);
    }
  }

  async function handleToggleFavorite(id: string) {
    try {
      const recipe = recipes.find(r => r.id === id);
      if (!recipe) return;

      await apiClient.updateRecipe(id, { isFavorite: !recipe.isFavorite });
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
    loadRecipes();
  }

  function handleSortChange(newSort: string) {
    sortBy = newSort;
    localStorage.setItem('recipeSortBy', sortBy);
    showMobileSort = false;
    loadRecipes();
  }

  function setCategory(newCategory: 'all' | 'food' | 'cocktails') {
    category = newCategory;
    localStorage.setItem('recipeCategory', newCategory);
    loadRecipes();
  }

  function setViewMode(mode: 'grid' | 'list' | 'compact') {
    viewMode = mode;
    // Save to localStorage
    localStorage.setItem('recipeViewMode', mode);
  }

  function triggerPhotoUpload() {
    photoInputRef?.click();
  }

  async function handlePhotoSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // Store in sessionStorage for the import page to pick up
      sessionStorage.setItem('quickPhotoImport', base64);
      goto('/recipe/import?mode=photo');
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    input.value = '';
  }

  function closeMobileSort() {
    showMobileSort = false;
  }

  function closeMobileFilter() {
    showMobileFilter = false;
  }

  function handleBackdropClick(event: MouseEvent, closeFn: () => void) {
    if (event.target === event.currentTarget) {
      closeFn();
    }
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="header">
      <h2>My Recipes</h2>
      <div class="header-actions">
        {#if hasPhotoExtraction}
          <button
            class="btn-primary btn-md"
            onclick={triggerPhotoUpload}
            title="Import from photo"
          >
            <Camera size={18} />
            <span class="btn-text">Scan Recipe</span>
          </button>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden-input"
            bind:this={photoInputRef}
            onchange={handlePhotoSelect}
          />
        {/if}
        <a href="/recipe/new" class="btn-primary btn-md">
          <Plus size={18} />
          <span class="btn-text">New Recipe</span>
        </a>
      </div>
    </div>

    <div class="category-tabs">
      <button
        class="tab"
        class:active={category === 'all'}
        onclick={() => setCategory('all')}
      >
        All
      </button>
      <button
        class="tab"
        class:active={category === 'food'}
        onclick={() => setCategory('food')}
      >
        <Flame size={16} />
        Food
      </button>
      <button
        class="tab"
        class:active={category === 'cocktails'}
        onclick={() => setCategory('cocktails')}
      >
        <Wine size={16} />
        Cocktails
      </button>
    </div>

    <div class="filters-section">
      <!-- Unified search row -->
      <div class="search-row">
        <div class="search-input-wrapper">
          <Search size={18} class="search-icon" />
          <input
            type="search"
            bind:value={searchTerm}
            placeholder="Search recipes..."
            onkeydown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <!-- Desktop: Dropdown menus under buttons -->
        <div class="desktop-menu-wrapper">
          <button
            class="filter-btn"
            class:active={showViewDropdown}
            onclick={() => { showViewDropdown = !showViewDropdown; showSortDropdown = false; showFilterDropdown = false; }}
            aria-label="View options"
            aria-expanded={showViewDropdown}
          >
            {#if viewMode === 'grid'}
              <LayoutGrid size={20} />
            {:else if viewMode === 'list'}
              <List size={20} />
            {:else}
              <PanelTop size={20} />
            {/if}
          </button>
          {#if showViewDropdown}
            <div class="dropdown-menu">
              <button
                class="dropdown-item"
                class:active={viewMode === 'grid'}
                onclick={() => { setViewMode('grid'); showViewDropdown = false; }}
              >
                <LayoutGrid size={18} />
                <span>Grid</span>
                {#if viewMode === 'grid'}
                  <span class="check">✓</span>
                {/if}
              </button>
              <button
                class="dropdown-item"
                class:active={viewMode === 'list'}
                onclick={() => { setViewMode('list'); showViewDropdown = false; }}
              >
                <List size={18} />
                <span>List</span>
                {#if viewMode === 'list'}
                  <span class="check">✓</span>
                {/if}
              </button>
              <button
                class="dropdown-item"
                class:active={viewMode === 'compact'}
                onclick={() => { setViewMode('compact'); showViewDropdown = false; }}
              >
                <PanelTop size={18} />
                <span>Compact</span>
                {#if viewMode === 'compact'}
                  <span class="check">✓</span>
                {/if}
              </button>
            </div>
          {/if}
        </div>

        <div class="desktop-menu-wrapper">
          <button
            class="filter-btn"
            class:active={showSortDropdown}
            onclick={() => { showSortDropdown = !showSortDropdown; showViewDropdown = false; showFilterDropdown = false; }}
            aria-label="Sort"
            aria-expanded={showSortDropdown}
          >
            <ArrowDownUp size={20} />
          </button>
          {#if showSortDropdown}
            <div class="dropdown-menu">
              {#each sortOptions as option}
                <button
                  class="dropdown-item"
                  class:active={sortBy === option.value}
                  onclick={() => { handleSortChange(option.value); showSortDropdown = false; }}
                >
                  <span>{option.label}</span>
                  {#if sortBy === option.value}
                    <span class="check">✓</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="desktop-menu-wrapper">
          <button
            class="filter-btn"
            class:active={selectedTags.length > 0 || showFilterDropdown}
            onclick={() => { showFilterDropdown = !showFilterDropdown; showViewDropdown = false; showSortDropdown = false; }}
            aria-label="Filter by tag"
            aria-expanded={showFilterDropdown}
          >
            <SlidersHorizontal size={20} />
          </button>
          {#if showFilterDropdown}
            <div class="dropdown-menu filter-menu">
              {#if selectedTags.length > 0}
                <div class="dropdown-section">
                  <span class="dropdown-label">Selected</span>
                  <div class="selected-tags-list">
                    {#each selectedTags as tag}
                      <button class="selected-tag-chip" onclick={() => toggleTag(tag)}>
                        {tag}
                        <X size={14} />
                      </button>
                    {/each}
                  </div>
                </div>
                <div class="dropdown-divider"></div>
              {/if}
              <div class="dropdown-section">
                <span class="dropdown-label">All Tags</span>
                <div class="tag-options">
                  {#each allTags as tag (tag.id)}
                    <button
                      class="tag-option-item"
                      class:active={selectedTags.includes(tag.name)}
                      onclick={() => toggleTag(tag.name)}
                    >
                      {tag.name}
                      <span class="count">({tag.recipeCount})</span>
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Mobile: Sheet triggers -->
        <button
          class="filter-btn mobile-only"
          class:active={showMobileSort}
          onclick={() => showMobileSort = true}
          aria-label="Sort"
        >
          <ArrowDownUp size={20} />
        </button>
        <button
          class="filter-btn mobile-only"
          class:active={selectedTags.length > 0}
          onclick={() => showMobileFilter = true}
          aria-label="Filter by tag"
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>

      {#if selectedTags.length > 0}
        <div class="active-filters">
          <span class="filter-label">Filters:</span>
          {#each selectedTags as tag}
            <span class="active-tag">
              {tag}
              <button onclick={() => toggleTag(tag)} class="remove-tag">✕</button>
            </span>
          {/each}
          <button onclick={clearFilters} class="clear-btn">Clear</button>
        </div>
      {/if}
    </div>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    {#if loading}
      <LoadingSkeleton variant="card" count={6} {viewMode} />
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

<!-- Mobile Sort Sheet -->
{#if showMobileSort}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="mobile-sheet-backdrop"
    onclick={(e) => handleBackdropClick(e, closeMobileSort)}
    role="presentation"
  >
    <div class="mobile-sheet" role="dialog" aria-modal="true" aria-label="Sort options">
      <div class="sheet-handle">
        <div class="handle-bar"></div>
      </div>
      <div class="sheet-header">
        <h3>Sort By</h3>
        <button class="sheet-close" onclick={closeMobileSort} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div class="sheet-content">
        {#each sortOptions as option}
          <button
            class="sheet-option"
            class:active={sortBy === option.value}
            onclick={() => handleSortChange(option.value)}
          >
            {option.label}
            {#if sortBy === option.value}
              <span class="check">✓</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- Mobile Filter Sheet -->
{#if showMobileFilter}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="mobile-sheet-backdrop"
    onclick={(e) => handleBackdropClick(e, closeMobileFilter)}
    role="presentation"
  >
    <div class="mobile-sheet" role="dialog" aria-modal="true" aria-label="Filter by tag">
      <div class="sheet-handle">
        <div class="handle-bar"></div>
      </div>
      <div class="sheet-header">
        <h3>Filter by Tag</h3>
        <button class="sheet-close" onclick={closeMobileFilter} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div class="sheet-content">
        {#if selectedTags.length > 0}
          <div class="selected-tags">
            {#each selectedTags as tag}
              <button class="selected-tag" onclick={() => toggleTag(tag)}>
                {tag}
                <X size={14} />
              </button>
            {/each}
          </div>
        {/if}
        <div class="tag-list">
          {#each allTags as tag (tag.id)}
            <button
              class="tag-option"
              class:active={selectedTags.includes(tag.name)}
              onclick={() => toggleTag(tag.name)}
            >
              {tag.name}
              <span class="tag-count">({tag.recipeCount})</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

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

  .header-actions {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
  }

  h2 {
    margin: 0;
    font-size: var(--text-2xl);
    color: var(--color-text);
    font-weight: var(--font-bold);
  }

  .hidden-input {
    display: none;
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

  .controls {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
    margin-bottom: var(--spacing-4);
  }

  .view-toggle {
    display: flex;
    gap: var(--spacing-1);
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
    background: #e8f0ec;
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-4);
  }

  .filter-label {
    font-weight: var(--font-semibold);
    color: #5a7a66;
    font-size: var(--text-sm);
  }

  .active-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-1) var(--spacing-2);
    background: white;
    border: 1px solid #7aa089;
    border-radius: var(--radius-sm);
    color: #5a7a66;
    font-size: var(--text-xs);
  }

  .remove-tag {
    background: none;
    border: none;
    cursor: pointer;
    color: #5a7a66;
    padding: 0;
    line-height: 1;
  }

  .clear-btn {
    padding: var(--spacing-1) var(--spacing-2);
    background: #7aa089;
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

  /* Category tabs */
  .category-tabs {
    display: flex;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-5);
    border-bottom: 2px solid var(--color-border);
    padding-bottom: var(--spacing-1);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-4);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-light);
    transition: var(--transition-fast);
  }

  .tab:hover {
    color: var(--color-text);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  /* Unified search row (desktop + mobile) */
  .search-row {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
    margin-bottom: var(--spacing-4);
  }

  .search-input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input-wrapper :global(.search-icon) {
    position: absolute;
    left: var(--spacing-3);
    color: var(--color-text-light);
    pointer-events: none;
  }

  .search-input-wrapper input {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-3) var(--spacing-3) var(--spacing-10);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    background: var(--color-surface);
    min-height: 44px;
  }

  .search-input-wrapper input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .filter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text-light);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .filter-btn.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .mobile-only {
    display: none;
  }

  /* Desktop menu wrapper with dropdown */
  .desktop-menu-wrapper {
    position: relative;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + var(--spacing-2));
    right: 0;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    min-width: 180px;
    padding: var(--spacing-2);
    z-index: 150;
    animation: dropdownFade 0.15s ease;
  }

  @keyframes dropdownFade {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .dropdown-item:hover {
    background: var(--color-bg-subtle);
  }

  .dropdown-item.active {
    background: var(--color-primary);
    color: white;
    font-weight: var(--font-semibold);
  }

  .dropdown-item .check {
    margin-left: auto;
    font-weight: var(--font-bold);
  }

  /* Filter dropdown specific */
  .filter-menu {
    min-width: 220px;
    max-height: 400px;
    overflow-y: auto;
  }

  .dropdown-section {
    padding: var(--spacing-2);
  }

  .dropdown-label {
    display: block;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--spacing-2);
  }

  .dropdown-divider {
    height: 1px;
    background: var(--color-border-light);
    margin: var(--spacing-1) 0;
  }

  .selected-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-1);
  }

  .selected-tag-chip {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .tag-options {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .tag-option-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .tag-option-item:hover {
    background: var(--color-bg-subtle);
  }

  .tag-option-item.active {
    background: var(--color-primary);
    color: white;
  }

  .tag-option-item .count {
    font-size: var(--text-xs);
    color: var(--color-text-light);
  }

  .tag-option-item.active .count {
    color: rgba(255, 255, 255, 0.8);
  }

  /* Sheets (mobile only) */
  .mobile-sheet-backdrop {
    display: flex;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .mobile-sheet {
    width: 100%;
    max-width: 600px;
    max-height: 70vh;
    background: white;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
    animation: slideUp 0.3s ease;
    padding-bottom: env(safe-area-inset-bottom);
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .sheet-handle {
    display: flex;
    justify-content: center;
    padding: var(--spacing-3) 0;
  }

  .handle-bar {
    width: 40px;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
  }

  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--spacing-5) var(--spacing-3);
    border-bottom: 1px solid var(--color-border-light);
  }

  .sheet-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
  }

  .sheet-close {
    background: none;
    border: none;
    padding: var(--spacing-2);
    color: var(--color-text-light);
    cursor: pointer;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    min-height: 36px;
  }

  .sheet-close:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  .sheet-content {
    padding: var(--spacing-3) var(--spacing-5) var(--spacing-6);
    max-height: 50vh;
    overflow-y: auto;
  }

  .sheet-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    margin-bottom: var(--spacing-1);
    background: none;
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .sheet-option:hover {
    background: var(--color-bg-subtle);
  }

  .sheet-option.active {
    background: var(--color-primary);
    color: white;
    font-weight: var(--font-semibold);
  }

  .sheet-option .check {
    font-weight: var(--font-bold);
  }

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-4);
    padding-bottom: var(--spacing-3);
    border-bottom: 1px solid var(--color-border-light);
  }

  .selected-tag {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-1) var(--spacing-3);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .tag-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .tag-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    background: none;
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .tag-option:hover {
    background: var(--color-bg-subtle);
  }

  .tag-option.active {
    background: var(--color-primary);
    color: white;
  }

  .tag-option .tag-count {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .tag-option.active .tag-count {
    color: rgba(255, 255, 255, 0.8);
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

    .btn-text {
      display: none;
    }

    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: flex;
    }

    /* Hide view button on mobile */
    .desktop-menu-wrapper {
      display: none;
    }

    .category-tabs {
      justify-content: stretch;
      margin-bottom: var(--spacing-3);
    }

    .tab {
      flex: 1;
      justify-content: center;
      padding: var(--spacing-2) var(--spacing-2);
      font-size: var(--text-xs);
    }

    /* Compact filters section on mobile */
    .filters-section {
      margin-bottom: var(--spacing-3);
    }

    .search-row {
      margin-bottom: var(--spacing-3);
    }

    .search-input-wrapper input {
      padding: var(--spacing-2) var(--spacing-3) var(--spacing-2) var(--spacing-10);
      font-size: var(--text-sm);
      min-height: 44px;
    }

    .active-filters {
      padding: var(--spacing-2);
      margin-bottom: var(--spacing-3);
    }

    .filter-label {
      font-size: var(--text-xs);
    }

    .active-tag {
      padding: 0.125rem var(--spacing-2);
      font-size: var(--text-xs);
    }

    .recipe-grid {
      grid-template-columns: 1fr !important;
      gap: var(--spacing-4);
    }
  }

  /* Hide header actions on mobile */
  @media (max-width: 768px) {
    .header-actions {
      display: none;
    }

    .header h2 {
      display: none;
    }

    .header {
      margin-bottom: 0;
    }
  }

  /* Remove old components */
  .search-bar,
  .controls,
  .tag-filter-collapsible,
  .view-toggle,
  .sort-control {
    display: none;
  }
</style>
