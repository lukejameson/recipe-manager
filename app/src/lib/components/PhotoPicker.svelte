<script lang="ts">
  import { apiClient } from '$lib/api/client';

  export type SelectedPhoto = {
    id: string;
    urls: {
      thumbnail?: string | null;
      medium?: string | null;
      original: string;
    };
    width?: number;
    height?: number;
    isNew?: boolean;
    pexelsId?: string;
    pexelsUrl?: string;
  };

  let {
    recipeId = '',
    maxSelectable = 5,
    initialTab = 'upload',
    initialQuery = '',
    onclose,
    onselect
  }: {
    recipeId?: string;
    maxSelectable?: number;
    initialTab?: 'upload' | 'pexels' | 'existing';
    initialQuery?: string;
    onclose: () => void;
    onselect: (photos: SelectedPhoto[]) => void;
  } = $props();
  type Tab = 'upload' | 'pexels' | 'existing';
  let activeTab = $state<Tab>(initialTab);
  let selectedPhotos = $state<SelectedPhoto[]>([]);
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let error = $state<string | null>(null);

  let pexelsQuery = $state('');
  let pexelsResults = $state<Array<{
    id: string;
    width: number;
    height: number;
    url: string;
    thumbnailUrl: string;
    photographer: string;
    alt: string;
  }>>([]);
  let pexelsLoading = $state(false);
  let pexelsSelected = $state<Set<string>>(new Set());

  let existingPhotos = $state<SelectedPhoto[]>([]);
  let loadingExisting = $state(false);

  let fileInput: HTMLInputElement;

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;

    const remaining = maxSelectable - selectedPhotos.length;
    const files = Array.from(input.files).slice(0, remaining);

    uploading = true;
    uploadProgress = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        uploadProgress = Math.round(((i + 0.5) / files.length) * 100);

        const { uploadUrl, publicUrl, storageKey, maxSizeBytes } = await apiClient.getUploadUrl(file.name, file.type);

        if (file.size > maxSizeBytes) {
          throw new Error(`${file.name} exceeds maximum size`);
        }

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });

        if (!uploadRes.ok) {
          throw new Error('Upload failed');
        }

        uploadProgress = Math.round(((i + 1) / files.length) * 100);
        const photo = await apiClient.confirmUpload(storageKey, file.type, file.size);
        selectedPhotos = [...selectedPhotos, {
          id: photo.id,
          urls: photo.urls,
          width: photo.width,
          height: photo.height,
          isNew: true
        }];
      } catch (err) {
        error = err instanceof Error ? err.message : 'Upload failed';
      }
    }

    uploading = false;
    uploadProgress = 0;
    input.value = '';
  }

  async function searchPexels() {
    if (!pexelsQuery.trim()) return;

    pexelsLoading = true;
    pexelsSelected = new Set();
    error = null;

    try {
      const result = await fetch(`/api/photos/pexels?query=${encodeURIComponent(pexelsQuery)}&per_page=15`);
      if (!result.ok) {
        throw new Error('Pexels search failed');
      }
      const data = await result.json();
      pexelsResults = data.photos;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Search failed';
      pexelsResults = [];
    } finally {
      pexelsLoading = false;
    }
  }

  function togglePexelsSelection(pexelsId: string) {
    if (pexelsSelected.has(pexelsId)) {
      pexelsSelected.delete(pexelsId);
    } else if (selectedPhotos.length < maxSelectable) {
      pexelsSelected.add(pexelsId);
    }
    pexelsSelected = new Set(pexelsSelected);
  }

  async function downloadSelectedPexels() {
    if (pexelsSelected.size === 0) return;

    uploading = true;
    uploadProgress = 0;
    error = null;

    const selected = pexelsResults.filter(p => pexelsSelected.has(p.id));
    const newPhotos: SelectedPhoto[] = [];
    let hasFailure = false;

    for (let i = 0; i < selected.length; i++) {
      const photo = selected[i];
      try {
        uploadProgress = Math.round(((i + 0.5) / selected.length) * 100);

        const result = await fetch('/api/photos/pexels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pexelsId: photo.id,
            url: photo.url,
            photographer: photo.photographer,
            alt: photo.alt
          })
        });

        if (!result.ok) {
          const errorData = await result.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to download ${photo.alt || 'photo'}`);
        }

        const data = await result.json();

        uploadProgress = Math.round(((i + 1) / selected.length) * 100);

        newPhotos.push({
          id: data.id,
          urls: data.urls,
          width: data.width,
          height: data.height,
          isNew: true
        });
      } catch (err) {
        error = err instanceof Error ? err.message : 'Download failed';
        hasFailure = true;
      }
    }

    selectedPhotos = [...selectedPhotos, ...newPhotos];
    if (hasFailure && newPhotos.length === 0) {
    } else {
      pexelsSelected = new Set();
    }
    uploading = false;
    uploadProgress = 0;
  }

  async function loadExistingPhotos() {
    loadingExisting = true;
    error = null;

    try {
      const photos = await apiClient.getMyPhotos();
      existingPhotos = photos.map((p: any) => ({
        id: p.id,
        urls: {
          thumbnail: p.urls?.thumbnail,
          medium: p.urls?.medium,
          original: p.urls?.original
        },
        width: p.width,
        height: p.height
      }));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load photos';
    } finally {
      loadingExisting = false;
    }
  }

  function toggleExistingSelection(photoId: string) {
    const idx = selectedPhotos.findIndex(p => p.id === photoId);
    if (idx >= 0) {
      selectedPhotos = selectedPhotos.filter(p => p.id !== photoId);
    } else if (selectedPhotos.length < maxSelectable) {
      const photo = existingPhotos.find(p => p.id === photoId);
      if (photo) {
        selectedPhotos = [...selectedPhotos, photo];
      }
    }
  }

  function removeSelected(photoId: string) {
    selectedPhotos = selectedPhotos.filter(p => p.id !== photoId);
    pexelsSelected.delete(photoId);
    pexelsSelected = new Set(pexelsSelected);
  }

  function handleConfirm() {
    onselect(selectedPhotos);
    onclose();
  }
  $effect(() => {
    if (activeTab === 'existing' && existingPhotos.length === 0) {
      loadExistingPhotos();
    }
  });

  $effect(() => {
    if (initialTab === 'pexels' && initialQuery) {
      pexelsQuery = initialQuery;
      searchPexels();
    }
  });

</script>

<div class="modal-overlay" onclick={onclose} role="dialog" aria-modal="true">
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h3>Add Photos</h3>
      <button class="btn-close" onclick={onclose}>&times;</button>
    </div>

    <nav class="tab-bar">
      <button
        class="tab"
        class:active={activeTab === 'upload'}
        onclick={() => activeTab = 'upload'}
      >
        Upload
      </button>
      <button
        class="tab"
        class:active={activeTab === 'pexels'}
        onclick={() => {
          activeTab = 'pexels';
          if (!pexelsQuery && initialQuery) {
            pexelsQuery = initialQuery;
            searchPexels();
          }
        }}
      >
        Pexels
      </button>
      <button
        class="tab"
        class:active={activeTab === 'existing'}
        onclick={() => activeTab = 'existing'}
      >
        Existing
      </button>
    </nav>

    <div class="modal-body">
      {#if error}
        <div class="error-banner">{error}</div>
      {/if}

      {#if activeTab === 'upload'}
        <div class="upload-area">
          <input
            bind:this={fileInput}
            type="file"
            accept="image/*"
            multiple
            onchange={handleFileSelect}
            class="file-input"
          />
          <div class="upload-prompt">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Tap to take photo or choose from gallery</span>
            <span class="hint">{selectedPhotos.length}/{maxSelectable} photos selected</span>
          </div>
        </div>

        {#if uploading}
          <div class="progress-bar">
            <div class="progress-fill" style="width: {uploadProgress}%"></div>
          </div>
        {/if}
      {/if}

      {#if activeTab === 'pexels'}
        <div class="pexels-search">
          <div class="search-row">
            <input
              type="text"
              placeholder="Search for photos..."
              bind:value={pexelsQuery}
              onkeydown={(e) => e.key === 'Enter' && searchPexels()}
            />
            <button class="btn-search" onclick={searchPexels} disabled={pexelsLoading}>
              {pexelsLoading ? '...' : 'Search'}
            </button>
          </div>

          {#if pexelsResults.length > 0}
            <div class="pexels-grid">
              {#each pexelsResults as photo}
                <button
                  class="pexels-item"
                  class:selected={pexelsSelected.has(photo.id)}
                  onclick={() => togglePexelsSelection(photo.id)}
                >
                  <img src={photo.thumbnailUrl} alt={photo.alt} />
                  {#if pexelsSelected.has(photo.id)}
                    <span class="check">✓</span>
                  {/if}
                </button>
              {/each}
            </div>

            {#if pexelsSelected.size > 0}
              <button class="btn-download" onclick={downloadSelectedPexels} disabled={uploading}>
                {uploading ? 'Downloading...' : `Download ${pexelsSelected.size} photo${pexelsSelected.size > 1 ? 's' : ''}`}
              </button>
            {/if}
          {/if}
        </div>
      {/if}

      {#if activeTab === 'existing'}
        {#if loadingExisting}
          <div class="loading">Loading your photos...</div>
        {:else if existingPhotos.length === 0}
          <div class="empty">No photos yet. Upload some first!</div>
        {:else}
          <div class="existing-grid">
            {#each existingPhotos as photo}
              <button
                class="existing-item"
                class:selected={selectedPhotos.some(p => p.id === photo.id)}
                onclick={() => toggleExistingSelection(photo.id)}
              >
                <img src={photo.urls.thumbnail || photo.urls.medium || photo.urls.original} alt="" />
                {#if selectedPhotos.some(p => p.id === photo.id)}
                  <span class="check">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      {/if}

      {#if selectedPhotos.length > 0}
        <div class="selected-section">
          <h4>Selected ({selectedPhotos.length}/{maxSelectable})</h4>
          <div class="selected-grid">
            {#each selectedPhotos as photo}
              <div class="selected-item">
                <img src={photo.urls.thumbnail || photo.urls.medium} alt="" />
                <button class="btn-remove" onclick={() => removeSelected(photo.id)}>×</button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-cancel" onclick={onclose}>Cancel</button>
      <button
        class="btn-confirm"
        onclick={handleConfirm}
        disabled={selectedPhotos.length === 0}
      >
        Add {selectedPhotos.length} Photo{selectedPhotos.length !== 1 ? 's' : ''}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000;
    padding: 0;
  }

  @media (min-width: 640px) {
    .modal-overlay {
      align-items: center;
      padding: 1rem;
    }
  }

  .modal {
    background: white;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  @media (min-width: 640px) {
    .modal {
      border-radius: var(--radius-xl);
      max-height: 80vh;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
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

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--color-border);
  }

  .tab {
    flex: 1;
    padding: 0.75rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }

  .tab:hover {
    color: var(--color-text);
  }

  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .error-banner {
    background: var(--color-error-bg, #fee2e2);
    color: var(--color-error, #dc2626);
    padding: 0.75rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .upload-area {
    position: relative;
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    padding: 3rem 1rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .upload-area:hover {
    border-color: var(--color-primary);
  }

  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .upload-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .upload-prompt .hint {
    font-size: 0.8rem;
  }

  .progress-bar {
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
    margin-top: 1rem;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s;
  }

  .pexels-search {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .search-row {
    display: flex;
    gap: 0.5rem;
  }

  .search-row input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.9rem;
  }

  .btn-search {
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }

  .pexels-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .pexels-item {
    position: relative;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    overflow: hidden;
    padding: 0;
    cursor: pointer;
  }

  .pexels-item.selected {
    border-color: var(--color-primary);
  }

  .pexels-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .pexels-item .check {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background: var(--color-primary);
    color: white;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }

  .btn-download {
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    padding: 0.75rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-download:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .existing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .existing-item {
    position: relative;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    overflow: hidden;
    padding: 0;
    cursor: pointer;
  }

  .existing-item.selected {
    border-color: var(--color-primary);
  }

  .existing-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .existing-item .check {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background: var(--color-primary);
    color: white;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }

  .selected-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .selected-section h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .selected-grid {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .selected-item {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .selected-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .btn-remove {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--color-error);
    color: white;
    border: none;
    border-radius: 50%;
    width: 1.25rem;
    height: 1.25rem;
    font-size: 0.75rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading, .empty {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-muted);
  }

  .modal-footer {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-subtle);
  }

  .btn-cancel {
    flex: 1;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.75rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-confirm {
    flex: 1;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    padding: 0.75rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-confirm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
