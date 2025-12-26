<script lang="ts">
  import { trpc } from '$lib/trpc/client';

  interface Props {
    recipeName: string;
    tags: string[];
    onSelect: (url: string) => void;
    onClose: () => void;
  }

  let { recipeName, tags, onSelect, onClose }: Props = $props();

  interface ImageResult {
    id: string;
    url: string;
    thumbnailUrl: string;
    alt: string;
    photographer: string;
  }

  let searchQuery = $state(recipeName);
  let loading = $state(false);
  let error = $state('');
  let images = $state<ImageResult[]>([]);
  let selectedImage = $state<ImageResult | null>(null);
  let page = $state(1);
  let hasMore = $state(false);
  let totalResults = $state(0);

  // Search on mount
  $effect(() => {
    if (recipeName) {
      searchImages();
    }
  });

  async function searchImages(loadMore = false) {
    if (!searchQuery.trim()) return;

    loading = true;
    error = '';

    try {
      const result = await trpc.recipe.searchImages.mutate({
        query: searchQuery.trim(),
        tags,
        page: loadMore ? page + 1 : 1,
      });

      if (loadMore) {
        images = [...images, ...result.images];
        page = result.page;
      } else {
        images = result.images;
        page = 1;
        selectedImage = null;
      }

      hasMore = result.hasMore;
      totalResults = result.totalResults;
    } catch (err: any) {
      error = err.message || 'Failed to search images';
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      searchImages();
    }
  }

  function handleSelectImage(image: ImageResult) {
    selectedImage = image;
  }

  function handleConfirmSelection() {
    if (selectedImage) {
      onSelect(selectedImage.url);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h3>Find Recipe Image</h3>
      <button class="btn-close" onclick={onClose}>&times;</button>
    </div>

    <div class="search-bar">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search for images..."
        class="search-input"
      />
      <button class="btn-search" onclick={() => searchImages()} disabled={loading || !searchQuery.trim()}>
        {loading && images.length === 0 ? 'Searching...' : 'Search'}
      </button>
    </div>

    <div class="modal-body">
      {#if error}
        <div class="error-state">
          <p>{error}</p>
          <button class="btn-retry" onclick={() => searchImages()}>Try Again</button>
        </div>
      {:else if loading && images.length === 0}
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Searching for images...</p>
        </div>
      {:else if images.length === 0}
        <div class="empty-state">
          <p>No images found. Try a different search term.</p>
        </div>
      {:else}
        <div class="images-grid">
          {#each images as image (image.id)}
            <button
              class="image-card"
              class:selected={selectedImage?.id === image.id}
              onclick={() => handleSelectImage(image)}
            >
              <img src={image.thumbnailUrl} alt={image.alt} loading="lazy" />
              {#if selectedImage?.id === image.id}
                <div class="selected-overlay">
                  <span class="checkmark">&#10003;</span>
                </div>
              {/if}
            </button>
          {/each}
        </div>

        {#if hasMore}
          <div class="load-more">
            <button class="btn-load-more" onclick={() => searchImages(true)} disabled={loading}>
              {loading ? 'Loading...' : 'Load More'}
            </button>
            <span class="results-count">{images.length} of {totalResults} results</span>
          </div>
        {/if}
      {/if}

      {#if selectedImage}
        <div class="preview-section">
          <h4>Selected Image</h4>
          <div class="preview-container">
            <img src={selectedImage.url} alt={selectedImage.alt} class="preview-image" />
            <p class="photographer">Photo by {selectedImage.photographer} on Pexels</p>
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <span class="pexels-credit">
        Images by <a href="https://www.pexels.com" target="_blank" rel="noopener">Pexels</a>
      </span>
      <div class="footer-actions">
        <button class="btn-secondary" onclick={onClose}>Cancel</button>
        <button
          class="btn-primary"
          onclick={handleConfirmSelection}
          disabled={!selectedImage}
        >
          Use This Image
        </button>
      </div>
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
    max-width: 720px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4) var(--spacing-5);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: var(--text-xl);
    color: var(--color-text-light);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
  }

  .btn-close:hover {
    color: var(--color-text);
  }

  .search-bar {
    display: flex;
    gap: var(--spacing-2);
    padding: var(--spacing-4) var(--spacing-5);
    border-bottom: 1px solid var(--color-border);
  }

  .search-input {
    flex: 1;
    padding: var(--spacing-2) var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-family: inherit;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .btn-search {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-search:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-search:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4) var(--spacing-5);
  }

  .loading-state,
  .error-state,
  .empty-state {
    text-align: center;
    padding: var(--spacing-8);
    color: var(--color-text-light);
  }

  .error-state {
    color: var(--color-error);
  }

  .btn-retry {
    margin-top: var(--spacing-3);
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
  }

  .spinner {
    display: block;
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto var(--spacing-3);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--spacing-3);
  }

  .image-card {
    position: relative;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    overflow: hidden;
    cursor: pointer;
    padding: 0;
    background: var(--color-background);
    transition: var(--transition-fast);
  }

  .image-card:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
  }

  .image-card.selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary);
  }

  .image-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .selected-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 107, 53, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .checkmark {
    width: 32px;
    height: 32px;
    background: var(--color-primary);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-lg);
    font-weight: bold;
  }

  .load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-4);
    margin-top: var(--spacing-4);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-border);
  }

  .btn-load-more {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-load-more:hover:not(:disabled) {
    background: var(--color-surface);
    border-color: var(--color-primary);
  }

  .btn-load-more:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .results-count {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .preview-section {
    margin-top: var(--spacing-4);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-border);
  }

  .preview-section h4 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-light);
  }

  .preview-container {
    text-align: center;
  }

  .preview-image {
    max-width: 100%;
    max-height: 300px;
    border-radius: var(--radius-lg);
    object-fit: contain;
  }

  .photographer {
    margin: var(--spacing-2) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3) var(--spacing-5);
    border-top: 1px solid var(--color-border);
  }

  .pexels-credit {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .pexels-credit a {
    color: var(--color-primary);
    text-decoration: none;
  }

  .pexels-credit a:hover {
    text-decoration: underline;
  }

  .footer-actions {
    display: flex;
    gap: var(--spacing-3);
  }

  .btn-secondary {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-secondary:hover {
    background: var(--color-surface);
  }

  .btn-primary {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .modal {
      max-height: 90vh;
    }

    .images-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .modal-footer {
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .footer-actions {
      width: 100%;
    }

    .btn-secondary,
    .btn-primary {
      flex: 1;
    }
  }
</style>
