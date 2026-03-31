<script lang="ts">
  import { apiClient } from '$lib/api/client';
  import { allTags } from '$lib/stores/tags.svelte';
  import type { Tag as TagType } from '$lib/server/db/schema';
  import {
    Apple,
    Archive,
    Beef,
    Bookmark,
    Brain,
    Calendar,
    Camera,
    Carrot,
    ChefHat,
    Cherry,
    Clock,
    Cloud,
    Cookie,
    CookingPot,
    Egg,
    Filter,
    Flame,
    Folder,
    Gamepad2,
    Gift,
    Globe,
    Grape,
    Grid3X3,
    Hash,
    Heart,
    Leaf,
    List,
    MapPin,
    Milk,
    Music,
    Palette,
    Pizza,
    Salad,
    Sandwich,
    Search,
    ShoppingCart,
    Snowflake,
    Soup,
    Sparkles,
    Star,
    Sun,
    Tag,
    Truck,
    Utensils,
    UtensilsCrossed,
    Wand,
    Wine,
    X,
  } from 'lucide-svelte';
  interface Props {
    open?: boolean;
    categoryId?: string | null;
    initialName?: string;
    initialIconName?: string | null;
    initialTagIds?: string[];
    initialTagPatterns?: string[];
    onsave?: (data: { name: string; iconName: string | null; tagIds: string[]; tagPatterns: string[] }) => void;
    oncancel?: () => void;
  }
  let {
    open = false,
    categoryId = null,
    initialName = '',
    initialIconName = null,
    initialTagIds = [],
    initialTagPatterns = [],
    onsave,
    oncancel
  }: Props = $props();
  let name = $state(initialName);
  let iconName = $state<string | null>(initialIconName);
  let tagPatternsText = $state(initialTagPatterns.join(', '));
  let selectedTagIds = $state<string[]>(initialTagIds);
  let saving = $state(false);
  let error = $state('');
  let tagSearch = $state('');
  let iconSearch = $state('');

  const iconOptions = [
    { name: 'Utensils', component: Utensils, category: 'cooking' },
    { name: 'UtensilsCrossed', component: UtensilsCrossed, category: 'cooking' },
    { name: 'CookingPot', component: CookingPot, category: 'cooking' },
    { name: 'ChefHat', component: ChefHat, category: 'cooking' },
    { name: 'Flame', component: Flame, category: 'food' },
    { name: 'Wand', component: Wand, category: 'food' },
    { name: 'Apple', component: Apple, category: 'food' },
    { name: 'Cherry', component: Cherry, category: 'food' },
    { name: 'Grape', component: Grape, category: 'food' },
    { name: 'Carrot', component: Carrot, category: 'food' },
    { name: 'Egg', component: Egg, category: 'food' },
    { name: 'Beef', component: Beef, category: 'food' },
    { name: 'Salad', component: Salad, category: 'food' },
    { name: 'Soup', component: Soup, category: 'food' },
    { name: 'Pizza', component: Pizza, category: 'food' },
    { name: 'Cookie', component: Cookie, category: 'food' },
    { name: 'Sandwich', component: Sandwich, category: 'food' },
    { name: 'Milk', component: Milk, category: 'food' },
    { name: 'Wine', component: Wine, category: 'food' },
    { name: 'Heart', component: Heart, category: 'health' },
    { name: 'Brain', component: Brain, category: 'health' },
    { name: 'Sparkles', component: Sparkles, category: 'health' },
    { name: 'Leaf', component: Leaf, category: 'nature' },
    { name: 'Snowflake', component: Snowflake, category: 'nature' },
    { name: 'Sun', component: Sun, category: 'nature' },
    { name: 'Cloud', component: Cloud, category: 'nature' },
    { name: 'MapPin', component: MapPin, category: 'location' },
    { name: 'Globe', component: Globe, category: 'location' },
    { name: 'Truck', component: Truck, category: 'shopping' },
    { name: 'ShoppingCart', component: ShoppingCart, category: 'shopping' },
    { name: 'Tag', component: Tag, category: 'organization' },
    { name: 'Bookmark', component: Bookmark, category: 'organization' },
    { name: 'Folder', component: Folder, category: 'organization' },
    { name: 'Archive', component: Archive, category: 'organization' },
    { name: 'Grid3X3', component: Grid3X3, category: 'organization' },
    { name: 'List', component: List, category: 'organization' },
    { name: 'Filter', component: Filter, category: 'organization' },
    { name: 'Star', component: Star, category: 'rating' },
    { name: 'Search', component: Search, category: 'actions' },
    { name: 'Palette', component: Palette, category: 'creative' },
    { name: 'Music', component: Music, category: 'creative' },
    { name: 'Gamepad2', component: Gamepad2, category: 'creative' },
    { name: 'Clock', component: Clock, category: 'time' },
    { name: 'Calendar', component: Calendar, category: 'time' },
    { name: 'Hash', component: Hash, category: 'other' },
    { name: 'Gift', component: Gift, category: 'other' },
    { name: 'Camera', component: Camera, category: 'other' },
  ];

  let filteredTags = $derived(
    tagSearch.trim() === ''
      ? $allTags
      : $allTags.filter(tag =>
          tag.name.toLowerCase().includes(tagSearch.toLowerCase())
        )
  );

  let filteredIcons = $derived(
    iconSearch.trim() === ''
      ? iconOptions
      : iconOptions.filter(icon =>
          icon.name.toLowerCase().includes(iconSearch.toLowerCase())
        )
  );

  $effect(() => {
    name = initialName;
    iconName = initialIconName;
    selectedTagIds = initialTagIds;
    tagPatternsText = initialTagPatterns?.join(', ') || '';
  });

  function isTagSelected(tagId: string): boolean {
    return selectedTagIds.includes(tagId);
  }

  function toggleTag(tagId: string): void {
    if (selectedTagIds.includes(tagId)) {
      selectedTagIds = selectedTagIds.filter(id => id !== tagId);
    } else {
      selectedTagIds = [...selectedTagIds, tagId];
    }
  }

  function handleSubmit() {
    if (!name.trim()) {
      error = 'Category name is required';
      return;
    }
    saving = true;
    error = '';
    try {
      const patterns = tagPatternsText
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      onsave?.({ name: name.trim(), iconName, tagIds: selectedTagIds, tagPatterns: patterns });
      resetForm();
    } catch (err: any) {
      error = err.message || 'Failed to save category';
    } finally {
      saving = false;
    }
  }

  function resetForm() {
    name = '';
    iconName = null;
    selectedTagIds = [];
    tagPatternsText = '';
    tagSearch = '';
    iconSearch = '';
  }

  function handleClose() {
    resetForm();
    oncancel?.();
  }

  function clearTagSearch() {
    tagSearch = '';
  }

  function clearIconSearch() {
    iconSearch = '';
  }
</script>

{#if open}
  <div class="modal-overlay" onclick={handleClose}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>{categoryId ? 'Edit Category' : 'Add Category'}</h3>
        <button class="close-btn" onclick={handleClose}><X size={20} /></button>
      </div>
      <div class="modal-body">
        {#if error}
          <div class="error-message">{error}</div>
        {/if}
        <div class="form-group">
          <label for="categoryName">Name</label>
          <input
            id="categoryName"
            type="text"
            bind:value={name}
            placeholder="e.g., Main Dishes, Desserts, Snacks"
            maxlength={100}
          />
        </div>
        <div class="form-group">
          <label>Icon</label>
          <div class="search-input-wrapper">
            <span class="search-icon-wrapper"><Search size={16} /></span>
            <input
              type="text"
              bind:value={iconSearch}
              placeholder="Search icons..."
              class="search-input"
            />
            {#if iconSearch}
              <button class="clear-search-btn" onclick={clearIconSearch}>
                <X size={14} />
              </button>
            {/if}
          </div>
          <div class="icon-grid">
            {#if filteredIcons.length === 0}
              <p class="no-results">No icons match your search</p>
            {:else}
              {#each filteredIcons as { name: iconNameOption, component: IconComponent }}
                <button
                  type="button"
                  class="icon-option"
                  class:selected={iconName === iconNameOption}
                  onclick={() => (iconName = iconNameOption)}
                  title={iconNameOption}
                >
                  <IconComponent size={22} />
                </button>
              {/each}
            {/if}
          </div>
          {#if iconName}
            <button
              type="button"
              class="clear-icon-btn"
              onclick={() => (iconName = null)}
            >
              Clear Icon
            </button>
          {/if}
        </div>
        <div class="form-group">
          <label>Tags (optional)</label>
          <p class="hint">Select tags to automatically include recipes with those tags in this category.</p>
          <div class="search-input-wrapper">
            <span class="search-icon-wrapper"><Search size={16} /></span>
            <input
              type="text"
              bind:value={tagSearch}
              placeholder="Search tags..."
              class="search-input"
            />
            {#if tagSearch}
              <button class="clear-search-btn" onclick={clearTagSearch}>
                <X size={14} />
              </button>
            {/if}
          </div>
          <div class="tag-list">
            {#if !$allTags || $allTags.length === 0}
              <p class="no-tags">No tags created yet. Create tags from recipe management first.</p>
            {:else if filteredTags.length === 0}
              <p class="no-results">No tags match "{tagSearch}"</p>
            {:else}
              {#each filteredTags as tag (tag.id)}
                <label class="tag-option">
                  <input
                    type="checkbox"
                    checked={isTagSelected(tag.id)}
                    onchange={() => toggleTag(tag.id)}
                  />
                  <span>{tag.name}</span>
                </label>
              {/each}
            {/if}
          </div>
        </div>
        <div class="form-group">
          <label for="tagPatterns">Auto-match Tag Patterns (optional)</label>
          <p class="hint">Enter patterns separated by commas. Use * as wildcard. Matching tags will be auto-added. Example: *bread*, dinner*, *pasta</p>
          <input
            id="tagPatterns"
            type="text"
            bind:value={tagPatternsText}
            placeholder="*bread*, dinner*, *pasta"
            class="tag-patterns-input"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={handleClose} disabled={saving}>Cancel</button>
        <button class="btn-primary" onclick={handleSubmit} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : categoryId ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }
  .modal-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .close-btn:hover {
    background: #f3f4f6;
    color: #111827;
  }
  .modal-body {
    padding: 1.5rem;
  }
  .modal-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 0 0 12px 12px;
  }
  .form-group {
    margin-bottom: 1.25rem;
  }
  .form-group:last-child {
    margin-bottom: 0;
  }
  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #111827;
    font-size: 0.875rem;
  }
  .form-group input[type='text'] {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    box-sizing: border-box;
  }
  .form-group input[type='text']:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  .search-input-wrapper {
    position: relative;
    margin-bottom: 0.75rem;
  }
  .search-icon-wrapper {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    display: flex;
    align-items: center;
    pointer-events: none;
    z-index: 1;
  }
  div.search-input-wrapper input.search-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    padding-left: 36px;
    padding-right: 32px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    background: #f9fafb;
    box-sizing: border-box;
  }
  div.search-input-wrapper input.search-input:focus {
    outline: none;
    border-color: #3b82f6;
    background: white;
  }
  .clear-search-btn {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  .clear-search-btn:hover {
    color: #6b7280;
    background: #e5e7eb;
  }
  .hint {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0.25rem 0 0.5rem;
  }
  .error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.4rem;
    margin-bottom: 0.5rem;
    max-height: 180px;
    overflow-y: auto;
    padding: 0.25rem;
    background: #f9fafb;
    border-radius: 6px;
  }
  .icon-option {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: 2px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: all 0.15s;
    color: #374151;
  }
  .icon-option:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }
  .icon-option.selected {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #3b82f6;
  }
  .clear-icon-btn {
    font-size: 0.75rem;
    color: #6b7280;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .clear-icon-btn:hover {
    color: #dc2626;
  }
  .tag-list {
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.5rem;
    background: #f9fafb;
  }
  .tag-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    color: #374151;
  }
  .tag-option:hover {
    background: #e5e7eb;
  }
  .tag-option input[type='checkbox'] {
    cursor: pointer;
  }
  .no-tags,
  .no-results {
    color: #6b7288;
    font-size: 0.875rem;
    text-align: center;
    padding: 1rem;
    margin: 0;
    grid-column: 1 / -1;
    white-space: nowrap;
  }
  .btn-primary {
    padding: 0.5rem 1rem;
    background: #16a34a;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-primary:hover:not(:disabled) {
    background: #15803d;
  }
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .btn-secondary {
    padding: 0.5rem 1rem;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-secondary:hover:not(:disabled) {
    background: #f3f4f6;
  }
  .btn-secondary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .icon-grid::-webkit-scrollbar,
  .tag-list::-webkit-scrollbar {
    width: 6px;
  }
  .icon-grid::-webkit-scrollbar-track,
  .tag-list::-webkit-scrollbar-track {
    background: transparent;
  }
  .icon-grid::-webkit-scrollbar-thumb,
  .tag-list::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }
  .icon-grid::-webkit-scrollbar-thumb:hover,
  .tag-list::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
  .tag-patterns-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    background: white;
    transition: border-color 0.15s;
  }
  .tag-patterns-input:focus {
    outline: none;
    border-color: #3b82f6;
  }
  .tag-patterns-input::placeholder {
    color: #9ca3af;
  }
</style>
