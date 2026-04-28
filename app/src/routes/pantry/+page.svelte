<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/client';
  import Header from '$lib/components/Header.svelte';
  import type { PantryItem } from '$lib/server/db/schema';

  const CATEGORIES = ['produce', 'dairy', 'meat', 'grains', 'canned', 'condiments', 'spices', 'frozen', 'snacks', 'other'];
  const UNITS = ['cups', 'tbsp', 'tsp', 'oz', 'lbs', 'kg', 'g', 'ml', 'L', 'pieces', 'cans', 'bunches'];

  let items = $state<PantryItem[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showAddModal = $state(false);
  let showQuickAddModal = $state(false);
  let showEditModal = $state(false);
  let editingItem = $state<PantryItem | null>(null);

  let newIngredient = $state('');
  let newDisplayName = $state('');
  let newQuantity = $state('');
  let newUnit = $state('');
  let newCategory = $state('other');
  let newExpirationDate = $state('');
  let newThreshold = $state('1');

  let quickAddText = $state('');

  let filterCategory = $state('all');
  let sortBy = $state<'name' | 'expiration' | 'lowstock'>('name');

  onMount(() => {
    loadItems();
  });

  async function loadItems() {
    loading = true;
    error = '';
    try {
      items = await apiClient.getPantryItems();
    } catch (err: any) {
      error = err.message || 'Failed to load pantry';
    } finally {
      loading = false;
    }
  }

  function isLowStock(item: PantryItem): boolean {
    return item.quantity !== null && item.threshold !== null && item.quantity < item.threshold;
  }

  function isExpired(item: PantryItem): boolean {
    if (!item.expirationDate) return false;
    return new Date(item.expirationDate) < new Date();
  }

  function isExpiringSoon(item: PantryItem): boolean {
    if (!item.expirationDate) return false;
    const expDate = new Date(item.expirationDate);
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return expDate >= now && expDate <= threeDaysFromNow;
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function resetForm() {
    newIngredient = '';
    newDisplayName = '';
    newQuantity = '';
    newUnit = '';
    newCategory = 'other';
    newExpirationDate = '';
    newThreshold = '1';
  }

  function openEdit(item: PantryItem) {
    editingItem = item;
    newIngredient = item.ingredient;
    newDisplayName = item.displayName;
    newQuantity = item.quantity?.toString() || '';
    newUnit = item.unit || '';
    newCategory = item.category || 'other';
    newExpirationDate = item.expirationDate ? new Date(item.expirationDate).toISOString().split('T')[0] : '';
    newThreshold = item.threshold?.toString() || '1';
    showEditModal = true;
  }

  function closeEdit() {
    showEditModal = false;
    editingItem = null;
    resetForm();
  }

  async function handleAddItem(e: Event) {
    e.preventDefault();
    if (!newIngredient.trim()) return;

    try {
      await apiClient.addPantryItem({
        ingredient: newIngredient.trim().toLowerCase(),
        displayName: newDisplayName.trim() || newIngredient.trim(),
        quantity: newQuantity ? parseFloat(newQuantity) : undefined,
        unit: newUnit || undefined,
        category: newCategory || undefined,
        expirationDate: newExpirationDate || undefined,
        threshold: parseFloat(newThreshold) || 1,
      });
      resetForm();
      showAddModal = false;
      loadItems();
    } catch (err: any) {
      alert('Failed to add item: ' + err.message);
    }
  }

  async function handleUpdateItem(e: Event) {
    e.preventDefault();
    if (!editingItem || !newIngredient.trim()) return;

    try {
      await apiClient.updatePantryItem(editingItem.id, {
        ingredient: newIngredient.trim().toLowerCase(),
        displayName: newDisplayName.trim() || newIngredient.trim(),
        quantity: newQuantity ? parseFloat(newQuantity) : null,
        unit: newUnit || null,
        category: newCategory || null,
        expirationDate: newExpirationDate || null,
        threshold: parseFloat(newThreshold) || null,
      });
      closeEdit();
      loadItems();
    } catch (err: any) {
      alert('Failed to update item: ' + err.message);
    }
  }

  async function handleDeleteItem(id: string) {
    if (!confirm('Delete this pantry item?')) return;
    try {
      await apiClient.deletePantryItem(id);
      loadItems();
    } catch (err: any) {
      alert('Failed to delete item: ' + err.message);
    }
  }

  async function handleQuickAdd(e: Event) {
    e.preventDefault();
    if (!quickAddText.trim()) return;

    try {
      await apiClient.quickAddPantryItems(quickAddText);
      quickAddText = '';
      showQuickAddModal = false;
      loadItems();
    } catch (err: any) {
      alert('Failed to quick add items: ' + err.message);
    }
  }

  async function handleClearAll() {
    if (!confirm('Clear entire pantry? This cannot be undone.')) return;
    try {
      await apiClient.clearPantry();
      loadItems();
    } catch (err: any) {
      alert('Failed to clear pantry: ' + err.message);
    }
  }

  const filteredItems = $derived(() => {
    let result = items;
    if (filterCategory !== 'all') {
      result = result.filter(i => i.category === filterCategory);
    }
      return [...result].sort((a, b) => {
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      if (sortBy === 'expiration') {
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      }
      if (sortBy === 'lowstock') {
        const aStock = a.quantity !== null ? a.quantity - (a.threshold || 1) : 999;
        const bStock = b.quantity !== null ? b.quantity - (b.threshold || 1) : 999;
        return aStock - bStock;
      }
      return 0;
    });
  });

  const itemsByCategory = $derived(
    CATEGORIES.map(cat => ({
      category: cat,
      items: filteredItems().filter(i => i.category === cat)
    })).filter(g => g.items.length > 0)
  );

  const lowStockCount = $derived(items.filter(i => isLowStock(i)).length);
</script>

<Header />

<main>
  <div class="container">
    <div class="header">
      <div class="title-row">
        <h1>My Pantry</h1>
        {#if lowStockCount > 0}
          <span class="low-stock-badge">{lowStockCount} low stock</span>
        {/if}
      </div>
      <div class="header-actions">
        <button onclick={() => showQuickAddModal = true} class="btn-quick">
          ⚡ Quick Add
        </button>
        <button onclick={() => showAddModal = true} class="btn-add">
          + Add Item
        </button>
      </div>
    </div>

    {#if loading}
      <div class="loading">Loading pantry...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else}
      {#if showAddModal}
        <div class="modal-overlay" onclick={() => showAddModal = false}>
          <div class="modal-content" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Add Pantry Item</h2>
              <button onclick={() => showAddModal = false} class="btn-close">✕</button>
            </div>
            <form onsubmit={handleAddItem} class="form">
              <div class="form-group">
                <label for="ingredient">Ingredient *</label>
                <input id="ingredient" type="text" bind:value={newIngredient} placeholder="e.g., Tomatoes" required />
              </div>
              <div class="form-group">
                <label for="displayName">Display Name</label>
                <input id="displayName" type="text" bind:value={newDisplayName} placeholder="Optional custom name" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="quantity">Quantity</label>
                  <input id="quantity" type="number" step="0.01" bind:value={newQuantity} placeholder="e.g., 2" />
                </div>
                <div class="form-group">
                  <label for="unit">Unit</label>
                  <select id="unit" bind:value={newUnit}>
                    <option value="">Select...</option>
                    {#each UNITS as unit}
                      <option value={unit}>{unit}</option>
                    {/each}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label for="category">Category</label>
                <select id="category" bind:value={newCategory}>
                  {#each CATEGORIES as cat}
                    <option value={cat}>{cat}</option>
                  {/each}
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="expiration">Expiration Date</label>
                  <input id="expiration" type="date" bind:value={newExpirationDate} />
                </div>
                <div class="form-group">
                  <label for="threshold">Low Stock Threshold</label>
                  <input id="threshold" type="number" step="0.01" bind:value={newThreshold} placeholder="1" />
                </div>
              </div>
              <div class="form-actions">
                <button type="button" onclick={() => showAddModal = false} class="btn-cancel">Cancel</button>
                <button type="submit" class="btn-submit">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      {/if}

      {#if showEditModal && editingItem}
        <div class="modal-overlay" onclick={closeEdit}>
          <div class="modal-content" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Edit Pantry Item</h2>
              <button onclick={closeEdit} class="btn-close">✕</button>
            </div>
            <form onsubmit={handleUpdateItem} class="form">
              <div class="form-group">
                <label for="edit-ingredient">Ingredient *</label>
                <input id="edit-ingredient" type="text" bind:value={newIngredient} required />
              </div>
              <div class="form-group">
                <label for="edit-displayName">Display Name</label>
                <input id="edit-displayName" type="text" bind:value={newDisplayName} />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="edit-quantity">Quantity</label>
                  <input id="edit-quantity" type="number" step="0.01" bind:value={newQuantity} />
                </div>
                <div class="form-group">
                  <label for="edit-unit">Unit</label>
                  <select id="edit-unit" bind:value={newUnit}>
                    <option value="">Select...</option>
                    {#each UNITS as unit}
                      <option value={unit}>{unit}</option>
                    {/each}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label for="edit-category">Category</label>
                <select id="edit-category" bind:value={newCategory}>
                  {#each CATEGORIES as cat}
                    <option value={cat}>{cat}</option>
                  {/each}
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="edit-expiration">Expiration Date</label>
                  <input id="edit-expiration" type="date" bind:value={newExpirationDate} />
                </div>
                <div class="form-group">
                  <label for="edit-threshold">Low Stock Threshold</label>
                  <input id="edit-threshold" type="number" step="0.01" bind:value={newThreshold} />
                </div>
              </div>
              <div class="form-actions">
                <button type="button" onclick={() => handleDeleteItem(editingItem!.id)} class="btn-delete">Delete</button>
                <button type="button" onclick={closeEdit} class="btn-cancel">Cancel</button>
                <button type="submit" class="btn-submit">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      {/if}

      {#if showQuickAddModal}
        <div class="modal-overlay" onclick={() => showQuickAddModal = false}>
          <div class="modal-content" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Quick Add</h2>
              <button onclick={() => showQuickAddModal = false} class="btn-close">✕</button>
            </div>
            <form onsubmit={handleQuickAdd} class="form">
              <div class="form-group">
                <label for="quick-add">Enter ingredients, one per line or comma-separated</label>
                <textarea
                  id="quick-add"
                  bind:value={quickAddText}
                  placeholder="tomatoes, 5, cups
onion, 2, pieces
eggs, 12, pieces"
                  rows="8"
                ></textarea>
              </div>
              <p class="help-text">Format: ingredient, quantity, unit (unit and quantity are optional)</p>
              <div class="form-actions">
                <button type="button" onclick={() => showQuickAddModal = false} class="btn-cancel">Cancel</button>
                <button type="submit" class="btn-submit">Add Items</button>
              </div>
            </form>
          </div>
        </div>
      {/if}

      {#if items.length === 0}
        <div class="empty-state">
          <p>🍅🧅🥕</p>
          <p>Your pantry is empty</p>
          <p class="empty-subtitle">Start by adding ingredients you have at home</p>
          <div class="empty-actions">
            <button onclick={() => showQuickAddModal = true} class="btn-quick-large">⚡ Quick Add</button>
            <button onclick={() => showAddModal = true} class="btn-add-large">+ Add Item</button>
          </div>
        </div>
      {:else}
        <div class="filter-bar">
          <select bind:value={filterCategory} class="filter-select">
            <option value="all">All Categories</option>
            {#each CATEGORIES as cat}
              <option value={cat}>{cat}</option>
            {/each}
          </select>
          <select bind:value={sortBy} class="filter-select">
            <option value="name">Name A-Z</option>
            <option value="expiration">Expiration</option>
            <option value="lowstock">Low Stock First</option>
          </select>
        </div>

        <div class="list-actions">
          <div class="stats">
            {items.length} item{items.length !== 1 ? 's' : ''} total
            {#if lowStockCount > 0}
              • {lowStockCount} low stock
            {/if}
          </div>
          <button onclick={handleClearAll} class="btn-clear-all">Clear All</button>
        </div>

        <div class="pantry-list">
          {#each itemsByCategory as { category, items: categoryItems }}
            <div class="category-section">
              <h2 class="category-title">{category}</h2>
              <div class="items">
                {#each categoryItems as item}
                  <div
                    class="pantry-item"
                    class:low-stock={isLowStock(item)}
                    class:expired={isExpired(item)}
                    class:expiring-soon={isExpiringSoon(item)}
                  >
                    <button class="item-content" onclick={() => openEdit(item)}>
                      <div class="item-main">
                        <span class="display-name">{item.displayName}</span>
                        {#if item.quantity !== null}
                          <span class="quantity">{item.quantity} {item.unit || ''}</span>
                        {/if}
                      </div>
                      <div class="item-meta">
                        {#if item.expirationDate}
                          <span class="expiration" class:expired={isExpired(item)} class:expiring-soon={isExpiringSoon(item)}>
                            {isExpired(item) ? 'Expired: ' : 'Exp: '}{formatDate(item.expirationDate)}
                          </span>
                        {/if}
                        {#if isLowStock(item)}
                          <span class="badge low">Low</span>
                        {/if}
                      </div>
                    </button>
                    <button onclick={() => handleDeleteItem(item.id)} class="btn-delete-item" title="Delete">🗑️</button>
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
    align-items: flex-start;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--color-text);
  }
  .low-stock-badge {
    background: #fef3c7;
    color: #92400e;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 600;
  }
  .header-actions {
    display: flex;
    gap: 0.5rem;
  }
  .btn-add, .btn-quick, .btn-add-large, .btn-quick-large {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }
  .btn-add, .btn-add-large {
    background: var(--color-primary);
    color: white;
  }
  .btn-quick, .btn-quick-large {
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border: 2px solid var(--color-border);
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
    overflow-y: auto;
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
    min-width: 44px;
    min-height: 44px;
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
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.875rem;
  }
  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 1rem;
  }
  .form-group textarea {
    resize: vertical;
  }
  .form-group select {
    text-transform: capitalize;
  }
  .help-text {
    font-size: 0.875rem;
    color: var(--color-text-light);
    margin-bottom: 1.5rem;
  }
  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    flex-wrap: wrap;
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
  .btn-delete {
    padding: 0.75rem 1.5rem;
    background: #fee;
    color: #c33;
    border: 2px solid #c33;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    margin-right: auto;
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
  .filter-bar {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .filter-select {
    padding: 0.5rem 1rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    background: white;
    cursor: pointer;
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
  .btn-clear-all {
    padding: 0.5rem 1rem;
    background: #fee;
    color: #c33;
    border: 2px solid #c33;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }
  .pantry-list {
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
  .pantry-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    transition: background 0.2s;
  }
  .pantry-item:hover {
    background: var(--color-bg-subtle);
  }
  .pantry-item.low-stock {
    background: #fef9ec;
  }
  .pantry-item.expired {
    background: #fef2f2;
  }
  .pantry-item.expired .display-name {
    text-decoration: line-through;
    color: #c33;
  }
  .pantry-item.expiring-soon {
    background: #fef9ec;
  }
  .item-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    padding: 0;
  }
  .item-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .display-name {
    font-weight: 600;
    color: var(--color-text);
  }
  .quantity {
    font-size: 0.875rem;
    color: var(--color-text-light);
  }
  .item-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .expiration {
    font-size: 0.875rem;
    color: var(--color-text-light);
  }
  .expiration.expired {
    color: #c33;
    font-weight: 600;
  }
  .expiration.expiring-soon {
    color: #92400e;
  }
  .badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
  }
  .badge.low {
    background: #fef3c7;
    color: #92400e;
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
    .btn-add, .btn-quick {
      width: 100%;
    }
    .form-row {
      grid-template-columns: 1fr;
    }
    .form-actions {
      flex-direction: column;
    }
    .btn-cancel, .btn-submit, .btn-delete {
      width: 100%;
    }
    .empty-actions {
      flex-direction: column;
    }
    .filter-bar {
      flex-direction: column;
    }
    .filter-select {
      width: 100%;
    }
    .list-actions {
      flex-direction: column;
      align-items: stretch;
    }
    .btn-clear-all {
      width: 100%;
    }
  }
</style>
