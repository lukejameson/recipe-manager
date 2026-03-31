<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/client';
  import Header from '$lib/components/Header.svelte';
  import CategoryModal from '$lib/components/CategoryModal.svelte';

  type Memory = { id: string; content: string; enabled: boolean; createdAt: Date };
  type Category = { 
    id: string; 
    name: string; 
    iconName: string | null; 
    sortOrder: number; 
    tagPatterns: string[]; 
    isDefault?: boolean; 
    tags: Array<{ id: string; name: string }> 
  };

  let loading = $state(true);
  let error = $state('');
  let memoriesSuccess = $state('');
  let memories = $state<Memory[]>([]);
  let newMemory = $state('');
  let savingMemory = $state(false);
  let categories = $state<Category[]>([]);
  let showCategoryModal = $state(false);
  let editingCategory: { id: string; name: string; iconName: string | null; tagIds: string[]; tagPatterns: string[] } | null = $state(null);
  let draggingCategoryId = $state<string | null>(null);
  let dragOverCategoryId = $state<string | null>(null);
  let saving = $state(false);

  onMount(async () => {
    try {
      const [userMemories, categoriesData] = await Promise.all([
        apiClient.getMemories(),
        apiClient.getRecipeCategories(),
      ]);
      memories = userMemories;
      categories = categoriesData;
    } catch (err: any) {
      error = err.message || 'Failed to load preferences';
    } finally {
      loading = false;
    }
  });

  async function handleAddMemory() {
    if (!newMemory.trim()) return;
    savingMemory = true;
    error = '';
    try {
      const memory = await apiClient.createMemory(newMemory.trim());
      memories = [memory, ...memories];
      newMemory = '';
      memoriesSuccess = 'Memory added!';
      setTimeout(() => { memoriesSuccess = ''; }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to add memory';
    } finally {
      savingMemory = false;
    }
  }

  async function handleToggleMemory(id: string, enabled: boolean) {
    try {
      await apiClient.updateMemory(id, { enabled });
      memories = memories.map((m) => (m.id === id ? { ...m, enabled } : m));
    } catch (err: any) {
      error = err.message || 'Failed to update memory';
    }
  }

  async function handleDeleteMemory(id: string) {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    try {
      await apiClient.deleteMemory(id);
      memories = memories.filter((m) => m.id !== id);
      memoriesSuccess = 'Memory deleted';
      setTimeout(() => { memoriesSuccess = ''; }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to delete memory';
    }
  }

  async function loadCategories() {
    try {
      categories = await apiClient.getRecipeCategories();
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  }

  function openAddCategory() {
    editingCategory = { id: '', name: '', iconName: null, tagIds: [], tagPatterns: [] };
    showCategoryModal = true;
  }

  function openEditCategory(category: Category) {
    editingCategory = {
      id: category.id,
      name: category.name,
      iconName: category.iconName,
      tagIds: category.tags.map(t => t.id),
      tagPatterns: category.tagPatterns || [],
    };
    showCategoryModal = true;
  }

  async function handleCategorySave(data: { name: string; iconName: string | null; tagIds: string[]; tagPatterns: string[] }) {
    if (!editingCategory) return;
    saving = true;
    error = '';
    try {
      if (editingCategory.id) {
        await apiClient.updateRecipeCategory(editingCategory.id, {
          name: data.name,
          iconName: data.iconName || undefined,
          tagIds: data.tagIds,
          tagPatterns: data.tagPatterns,
        });
      } else {
        await apiClient.createRecipeCategory({
          name: data.name,
          iconName: data.iconName || undefined,
          tagIds: data.tagIds,
          tagPatterns: data.tagPatterns,
        });
      }
      await loadCategories();
      showCategoryModal = false;
      editingCategory = null;
    } catch (err: any) {
      error = err.message || 'Failed to save category';
    } finally {
      saving = false;
    }
  }

  async function deleteCategory(category: Category) {
    if (!confirm(`Delete category "${category.name}"?`)) return;
    try {
      await apiClient.deleteRecipeCategory(category.id);
      categories = categories.filter(c => c.id !== category.id);
    } catch (err: any) {
      error = err.message || 'Failed to delete category';
    }
  }

  async function setDefaultCategory(categoryId: string) {
    try {
      await apiClient.updateRecipeCategory(categoryId, { isDefault: true });
      categories = categories.map(c => ({ ...c, isDefault: c.id === categoryId }));
    } catch (err: any) {
      error = err.message || 'Failed to set default category';
    }
  }

  function handleCategoryDragStart(e: DragEvent, categoryId: string) {
    draggingCategoryId = categoryId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleCategoryDragOver(e: DragEvent, categoryId: string) {
    e.preventDefault();
    dragOverCategoryId = categoryId;
  }

  async function handleCategoryDrop(e: DragEvent, targetCategoryId: string) {
    e.preventDefault();
    if (!draggingCategoryId || draggingCategoryId === targetCategoryId) {
      draggingCategoryId = null;
      dragOverCategoryId = null;
      return;
    }

    const draggedCategory = categories.find(c => c.id === draggingCategoryId);
    const targetCategory = categories.find(c => c.id === targetCategoryId);
    if (!draggedCategory || !targetCategory) return;

    const draggedSortOrder = targetCategory.sortOrder;
    const targetSortOrder = draggedCategory.sortOrder;

    const updatedCategories = categories.map(c => {
      if (c.id === draggingCategoryId) {
        return { ...c, sortOrder: draggedSortOrder };
      }
      if (c.id === targetCategoryId) {
        return { ...c, sortOrder: targetSortOrder };
      }
      return c;
    });

    categories = updatedCategories.sort((a, b) => a.sortOrder - b.sortOrder);
    draggingCategoryId = null;
    dragOverCategoryId = null;

    try {
      await Promise.all([
        apiClient.updateRecipeCategory(draggingCategoryId!, { sortOrder: draggedSortOrder }),
        apiClient.updateRecipeCategory(targetCategoryId, { sortOrder: targetSortOrder }),
      ]);
    } catch (err: any) {
      error = err.message || 'Failed to update category order';
      await loadCategories();
    }
  }

  function handleCategoryDragEnd() {
    draggingCategoryId = null;
    dragOverCategoryId = null;
  }
</script>

<Header />
<main>
  <div class="container">
    <h1>Preferences</h1>
    {#if loading}
      <div class="loading">Loading preferences...</div>
    {:else}
      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <section class="settings-section">
        <h2>My Preferences</h2>
        <p class="section-description">
          Tell us about your dietary needs, allergies, and cooking preferences. This helps personalize recipe suggestions and generated recipes just for you.
        </p>
        {#if memoriesSuccess}
          <div class="success-message">{memoriesSuccess}</div>
        {/if}
        {#if memories.length > 0}
          <div class="memories-list">
            {#each memories as memory (memory.id)}
              <div class="memory-item" class:disabled={!memory.enabled}>
                <label class="memory-toggle">
                  <input
                    type="checkbox"
                    checked={memory.enabled}
                    onchange={() => handleToggleMemory(memory.id, !memory.enabled)}
                  />
                  <span class="memory-content">{memory.content}</span>
                </label>
                <button
                  class="btn-icon-danger"
                  onclick={() => handleDeleteMemory(memory.id)}
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-state">No preferences added yet. Add some to get personalized recipe suggestions.</p>
        {/if}
        <div class="add-memory-form">
          <input
            type="text"
            bind:value={newMemory}
            placeholder="Add a preference..."
            maxlength="500"
            onkeydown={(e) => e.key === 'Enter' && handleAddMemory()}
          />
          <button class="btn-primary" onclick={handleAddMemory} disabled={savingMemory || !newMemory.trim()}>
            {savingMemory ? 'Adding...' : 'Add'}
          </button>
        </div>
        <p class="hint">
          Examples: "I'm vegetarian", "Allergic to nuts", "Low sodium diet", "Cooking for a family of 4", "I don't like cilantro"
        </p>
      </section>

      <section class="settings-section">
        <div class="section-header">
          <div>
            <h2>Recipe Categories</h2>
            <p class="section-description">
              Customize the category tabs on your Recipes page. Assign tags to each category to organize your recipes.
            </p>
          </div>
        </div>
        {#if categories.length === 0}
          <div class="empty-state">
            <p>No custom categories yet. Create your first category to start organizing your recipes.</p>
          </div>
        {:else}
          <div class="categories-list">
            {#each categories as category (category.id)}
              <div
                class="category-item"
                draggable="true"
                ondragstart={(e) => handleCategoryDragStart(e, category.id)}
                ondragover={(e) => handleCategoryDragOver(e, category.id)}
                ondrop={(e) => handleCategoryDrop(e, category.id)}
                ondragend={handleCategoryDragEnd}
                class:dragging={draggingCategoryId === category.id}
                class:drag-over={dragOverCategoryId === category.id}
              >
                <div class="drag-handle" aria-hidden="true">⋮⋮</div>
                <div class="category-info">
                  <span class="category-name">{category.name}</span>
                  <span class="category-tags-count">{category.tags?.length || 0} tags</span>
                </div>
                <div class="category-actions">
                  <button class="btn-icon" class:default-star={category.isDefault} onclick={() => setDefaultCategory(category.id)} title={category.isDefault ? 'Default category' : 'Set as default'}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={category.isDefault ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </button>
                  <button class="btn-icon" onclick={() => openEditCategory(category)} title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button class="btn-icon-danger" onclick={() => deleteCategory(category)} title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
        <div class="add-category-row">
          <button class="btn-primary" onclick={openAddCategory}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Category
          </button>
        </div>
      </section>
    {/if}
  </div>
</main>

{#if showCategoryModal && editingCategory}
  <CategoryModal
    open={showCategoryModal}
    categoryId={editingCategory.id}
    initialName={editingCategory.name}
    initialIconName={editingCategory.iconName}
    initialTagIds={editingCategory.tagIds}
    initialTagPatterns={editingCategory.tagPatterns}
    onsave={handleCategorySave}
    oncancel={() => {
      showCategoryModal = false;
      editingCategory = null;
    }}
  />
{/if}

<style>
  main {
    flex: 1;
    padding: 2rem 0;
  }
  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 1rem;
  }
  h1 {
    font-size: 2rem;
    margin: 0 0 2rem;
    color: var(--color-text);
  }
  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-light);
  }
  .settings-section {
    background: white;
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: 1.5rem;
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }
  .settings-section h2 {
    font-size: 1.25rem;
    margin: 0 0 0.5rem;
    color: var(--color-text);
  }
  .section-description {
    color: var(--color-text-light);
    margin: 0 0 1.5rem;
    line-height: 1.5;
  }
  .error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }
  .success-message {
    background: #dcfce7;
    color: #166534;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }
  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-light);
  }
  .empty-state p {
    margin: 0 0 0.5rem;
  }
  .memories-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .memory-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    transition: opacity 0.2s;
  }
  .memory-item.disabled {
    opacity: 0.5;
  }
  .memory-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    flex: 1;
  }
  .memory-toggle input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
    accent-color: var(--color-primary);
  }
  .memory-content {
    font-size: 0.95rem;
    color: var(--color-text);
  }
  .btn-icon-danger {
    background: none;
    border: none;
    color: #dc2626;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    transition: background 0.2s;
  }
  .btn-icon-danger:hover {
    background: rgba(220, 38, 38, 0.1);
  }
  .add-memory-form {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .add-memory-form input {
    flex: 1;
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: inherit;
  }
  .add-memory-form input:focus {
    outline: none;
    border-color: var(--color-primary);
  }
  .add-memory-form .btn-primary {
    padding: 0.75rem 1.25rem;
  }
  .hint {
    font-size: 0.875rem;
    color: var(--color-text-light);
    margin: 0.5rem 0 0;
  }
  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .categories-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .category-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    transition: all 0.15s ease;
  }
  .category-item:hover {
    border-color: var(--color-primary-light);
    background: var(--color-surface);
  }
  .category-item.dragging {
    opacity: 0.5;
    border-color: var(--color-primary);
  }
  .category-item.drag-over {
    border-color: var(--color-primary);
    background: rgba(122, 160, 137, 0.1);
  }
  .drag-handle {
    cursor: grab;
    color: var(--color-text-light);
    padding: 0.25rem;
    user-select: none;
  }
  .drag-handle:active {
    cursor: grabbing;
  }
  .category-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .category-name {
    font-weight: 500;
    color: var(--color-text);
  }
  .category-tags-count {
    font-size: 0.813rem;
    color: var(--color-text-light);
  }
  .category-actions {
    display: flex;
    gap: 0.5rem;
  }
  .btn-icon {
    background: none;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .btn-icon:hover {
    color: var(--color-primary);
    background: var(--color-background);
  }
  .default-star {
    color: #f59e0b;
  }
  .add-category-row {
    margin-top: 1rem;
  }
  .add-category-row .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  @media (max-width: 640px) {
    .add-memory-form {
      flex-direction: column;
    }
    .add-memory-form .btn-primary {
      width: 100%;
    }
  }
</style>
