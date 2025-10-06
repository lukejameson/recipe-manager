<script lang="ts">
  import { onMount } from 'svelte';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';

  let items = $state<any[]>([]);
  let allRecipes = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showAddItem = $state(false);
  let showGenerateFromRecipes = $state(false);

  // Add item form
  let newIngredient = $state('');
  let newQuantity = $state('');
  let newCategory = $state('other');

  // Generate from recipes
  let selectedRecipeIds = $state<string[]>([]);

  const categories = [
    'produce',
    'dairy',
    'meat',
    'pantry',
    'frozen',
    'bakery',
    'other',
  ];

  onMount(() => {
    loadItems();
    loadRecipes();
  });

  async function loadItems() {
    loading = true;
    error = '';
    try {
      items = await trpc.shoppingList.list.query();
    } catch (err: any) {
      error = err.message || 'Failed to load shopping list';
    } finally {
      loading = false;
    }
  }

  async function loadRecipes() {
    try {
      allRecipes = await trpc.recipe.list.query();
    } catch (err: any) {
      console.error('Failed to load recipes:', err);
    }
  }

  async function handleAddItem(e: Event) {
    e.preventDefault();

    if (!newIngredient.trim()) return;

    try {
      await trpc.shoppingList.addItem.mutate({
        ingredient: newIngredient.trim(),
        quantity: newQuantity.trim() || undefined,
        category: newCategory,
      });

      newIngredient = '';
      newQuantity = '';
      newCategory = 'other';
      showAddItem = false;
      loadItems();
    } catch (err: any) {
      alert('Failed to add item: ' + err.message);
    }
  }

  async function handleGenerateFromRecipes() {
    if (selectedRecipeIds.length === 0) {
      alert('Please select at least one recipe');
      return;
    }

    try {
      await trpc.shoppingList.generateFromRecipes.mutate({
        recipeIds: selectedRecipeIds,
      });

      selectedRecipeIds = [];
      showGenerateFromRecipes = false;
      loadItems();
    } catch (err: any) {
      alert('Failed to generate shopping list: ' + err.message);
    }
  }

  async function handleToggleChecked(id: string) {
    try {
      await trpc.shoppingList.toggleChecked.mutate({ id });
      loadItems();
    } catch (err: any) {
      alert('Failed to update item: ' + err.message);
    }
  }

  async function handleDeleteItem(id: string) {
    try {
      await trpc.shoppingList.deleteItem.mutate({ id });
      loadItems();
    } catch (err: any) {
      alert('Failed to delete item: ' + err.message);
    }
  }

  async function handleClearChecked() {
    if (!confirm('Remove all checked items?')) return;

    try {
      await trpc.shoppingList.clearChecked.mutate();
      loadItems();
    } catch (err: any) {
      alert('Failed to clear items: ' + err.message);
    }
  }

  async function handleClearAll() {
    if (!confirm('Clear entire shopping list?')) return;

    try {
      await trpc.shoppingList.clearAll.mutate();
      loadItems();
    } catch (err: any) {
      alert('Failed to clear list: ' + err.message);
    }
  }

  function toggleRecipeSelection(recipeId: string) {
    if (selectedRecipeIds.includes(recipeId)) {
      selectedRecipeIds = selectedRecipeIds.filter((id) => id !== recipeId);
    } else {
      selectedRecipeIds = [...selectedRecipeIds, recipeId];
    }
  }

  const itemsByCategory = $derived(
    categories.map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0)
  );

  const checkedCount = $derived(items.filter((item) => item.isChecked).length);
</script>

<Header />

<main>
  <div class="container">
    <div class="header">
      <h1>Shopping List</h1>
      <div class="header-actions">
        <button onclick={() => (showAddItem = true)} class="btn-add">
          + Add Item
        </button>
        <button
          onclick={() => (showGenerateFromRecipes = true)}
          class="btn-generate"
        >
          📋 From Recipes
        </button>
      </div>
    </div>

    {#if loading}
      <div class="loading">Loading shopping list...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else}
      {#if showAddItem}
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h2>Add Item</h2>
              <button onclick={() => (showAddItem = false)} class="btn-close">
                ✕
              </button>
            </div>

            <form onsubmit={handleAddItem} class="form">
              <div class="form-group">
                <label for="ingredient">Ingredient *</label>
                <input
                  id="ingredient"
                  type="text"
                  bind:value={newIngredient}
                  placeholder="e.g., Tomatoes"
                  required
                />
              </div>

              <div class="form-group">
                <label for="quantity">Quantity</label>
                <input
                  id="quantity"
                  type="text"
                  bind:value={newQuantity}
                  placeholder="e.g., 2 lbs"
                />
              </div>

              <div class="form-group">
                <label for="category">Category</label>
                <select id="category" bind:value={newCategory}>
                  {#each categories as cat}
                    <option value={cat}>{cat}</option>
                  {/each}
                </select>
              </div>

              <div class="form-actions">
                <button type="button" onclick={() => (showAddItem = false)} class="btn-cancel">
                  Cancel
                </button>
                <button type="submit" class="btn-submit">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      {/if}

      {#if showGenerateFromRecipes}
        <div class="modal-overlay">
          <div class="modal-content modal-large">
            <div class="modal-header">
              <h2>Generate from Recipes</h2>
              <button onclick={() => (showGenerateFromRecipes = false)} class="btn-close">
                ✕
              </button>
            </div>

            <div class="recipes-selection">
              {#if allRecipes.length === 0}
                <div class="empty-state">
                  <p>No recipes available</p>
                </div>
              {:else}
                <div class="recipes-list">
                  {#each allRecipes as recipe}
                    <label class="recipe-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedRecipeIds.includes(recipe.id)}
                        onchange={() => toggleRecipeSelection(recipe.id)}
                      />
                      <div class="recipe-info">
                        {#if recipe.imageUrl}
                          <img src={recipe.imageUrl} alt={recipe.title} class="recipe-thumb" />
                        {/if}
                        <div>
                          <div class="recipe-title">{recipe.title}</div>
                          {#if recipe.ingredients}
                            <div class="ingredient-count">
                              {recipe.ingredients.length} ingredients
                            </div>
                          {/if}
                        </div>
                      </div>
                    </label>
                  {/each}
                </div>

                <div class="generate-footer">
                  <div class="selection-count">
                    {selectedRecipeIds.length} recipe{selectedRecipeIds.length !== 1 ? 's' : ''} selected
                  </div>
                  <button
                    onclick={handleGenerateFromRecipes}
                    class="btn-generate-large"
                    disabled={selectedRecipeIds.length === 0}
                  >
                    Generate Shopping List
                  </button>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if items.length === 0}
        <div class="empty-state">
          <p>🛒 Your shopping list is empty</p>
          <p class="empty-subtitle">Add items manually or generate from recipes</p>
          <div class="empty-actions">
            <button onclick={() => (showAddItem = true)} class="btn-add-large">
              Add Item
            </button>
            <button
              onclick={() => (showGenerateFromRecipes = true)}
              class="btn-generate-large"
            >
              Generate from Recipes
            </button>
          </div>
        </div>
      {:else}
        <div class="list-actions">
          <div class="stats">
            {items.length} item{items.length !== 1 ? 's' : ''} total
            {#if checkedCount > 0}
              • {checkedCount} checked
            {/if}
          </div>
          <div class="bulk-actions">
            {#if checkedCount > 0}
              <button onclick={handleClearChecked} class="btn-clear">
                Clear Checked
              </button>
            {/if}
            <button onclick={handleClearAll} class="btn-clear-all">
              Clear All
            </button>
          </div>
        </div>

        <div class="shopping-list">
          {#each itemsByCategory as { category, items: categoryItems }}
            <div class="category-section">
              <h2 class="category-title">{category}</h2>
              <div class="items">
                {#each categoryItems as item}
                  <div class="item" class:checked={item.isChecked}>
                    <label class="item-checkbox">
                      <input
                        type="checkbox"
                        checked={item.isChecked}
                        onchange={() => handleToggleChecked(item.id)}
                      />
                      <div class="item-content">
                        <div class="ingredient">{item.ingredient}</div>
                        {#if item.quantity}
                          <div class="quantity">{item.quantity}</div>
                        {/if}
                      </div>
                    </label>
                    <button
                      onclick={() => handleDeleteItem(item.id)}
                      class="btn-delete-item"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: 2rem 0;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--color-text);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-add,
  .btn-generate {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-generate {
    background: var(--color-accent);
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-light);
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .modal-overlay {
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
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .modal-large {
    max-width: 700px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--color-text);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-text-light);
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .form {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 1rem;
  }

  .form-group select {
    text-transform: capitalize;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .btn-cancel {
    padding: 0.75rem 1.5rem;
    background: white;
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-submit {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .recipes-selection {
    display: flex;
    flex-direction: column;
    max-height: 70vh;
  }

  .recipes-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .recipe-checkbox {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    margin-bottom: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .recipe-checkbox:hover {
    background: var(--color-bg-subtle);
  }

  .recipe-checkbox input[type='checkbox'] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  .recipe-info {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .recipe-thumb {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .recipe-title {
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 0.25rem;
  }

  .ingredient-count {
    font-size: 0.875rem;
    color: var(--color-text-light);
  }

  .generate-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .selection-count {
    font-weight: 600;
    color: var(--color-text);
  }

  .btn-generate-large,
  .btn-add-large {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-generate-large:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .empty-state p {
    margin: 0;
    font-size: 1.5rem;
    color: var(--color-text);
  }

  .empty-subtitle {
    font-size: 1rem !important;
    color: var(--color-text-light) !important;
    margin-top: 0.5rem !important;
  }

  .empty-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 2rem;
  }

  .list-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .stats {
    color: var(--color-text-light);
    font-weight: 600;
  }

  .bulk-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-clear,
  .btn-clear-all {
    padding: 0.5rem 1rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    background: white;
    color: var(--color-text);
  }

  .btn-clear-all {
    background: #fee;
    color: #c33;
    border-color: #c33;
  }

  .shopping-list {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .category-section {
    background: white;
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .category-title {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    color: var(--color-primary);
    text-transform: capitalize;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--color-border);
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    transition: background 0.2s;
  }

  .item:hover {
    background: var(--color-bg-subtle);
  }

  .item.checked {
    opacity: 0.6;
  }

  .item.checked .ingredient {
    text-decoration: line-through;
  }

  .item-checkbox {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    cursor: pointer;
  }

  .item-checkbox input[type='checkbox'] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  .item-content {
    flex: 1;
  }

  .ingredient {
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 0.25rem;
  }

  .quantity {
    font-size: 0.875rem;
    color: var(--color-text-light);
  }

  .btn-delete-item {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0.5rem;
    opacity: 0.6;
  }

  .btn-delete-item:hover {
    opacity: 1;
  }

  @media (max-width: 640px) {
    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-actions {
      flex-direction: column;
    }

    .btn-add,
    .btn-generate {
      width: 100%;
    }

    .empty-actions {
      flex-direction: column;
    }

    .list-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .bulk-actions {
      flex-direction: column;
    }

    .btn-clear,
    .btn-clear-all {
      width: 100%;
    }
  }
</style>
