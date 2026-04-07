<script lang="ts">
  import { onMount } from 'svelte';

  export type PhotoData = {
    id: string;
    urls: {
      original: string;
      thumbnail: string;
      medium: string;
    };
    width: number;
    height: number;
    mimeType: string;
  };

  let {
    photos = $bindable([]),
    recipeId = '',
    maxPhotos = 5,
    disabled = false
  }: {
    photos: PhotoData[];
    recipeId?: string;
    maxPhotos?: number;
    disabled?: boolean;
  } = $props();

  let dragOver = $state(false);
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let error = $state<string | null>(null);
  let zoomedPhoto = $state<{ photo: PhotoData; index: number } | null>(null);
  let fileInput: HTMLInputElement;

  async function getUploadUrl(filename: string, contentType: string) {
    const params = new URLSearchParams({ filename, contentType });
    const res = await fetch(`/api/photos/upload-url?${params}`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to get upload URL');
    }
    return res.json();
  }

  async function confirmUpload(storageKey: string, mimeType: string, size: number) {
    const res = await fetch('/api/photos/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storageKey, mimeType, size, recipeId: recipeId || undefined })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to confirm upload');
    }
    return res.json();
  }

  async function uploadFile(file: File) {
    error = null;
    uploading = true;
    uploadProgress = 0;

    try {
      const { uploadUrl, publicUrl, storageKey, maxSizeBytes } = await getUploadUrl(file.name, file.type);

      if (file.size > maxSizeBytes) {
        throw new Error(`File size exceeds maximum of ${Math.round(maxSizeBytes / 1024 / 1024)}MB`);
      }

      uploadProgress = 10;

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      uploadProgress = 70;

      const photo = await confirmUpload(storageKey, file.type, file.size);

      uploadProgress = 100;

      photos = [...photos, {
        id: photo.id,
        urls: {
          original: publicUrl,
          thumbnail: publicUrl.replace(/(\.[^.]+)$/, '_thumb.webp'),
          medium: publicUrl.replace(/(\.[^.]+)$/, '_medium.webp')
        },
        width: photo.width,
        height: photo.height,
        mimeType: photo.mimeType
      }];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Upload failed';
    } finally {
      uploading = false;
      uploadProgress = 0;
    }
  }

  async function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((f) => f.type.startsWith('image/'));
    const remaining = maxPhotos - photos.length;
    const toProcess = imageFiles.slice(0, remaining);

    for (const file of toProcess) {
      await uploadFile(file);
    }
  }

  async function deletePhoto(index: number) {
    const photo = photos[index];
    try {
      const res = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete photo');
      }
      photos = photos.filter((_, i) => i !== index);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Delete failed';
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (disabled || uploading) return;
    if (e.dataTransfer?.files) {
      processFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!disabled && !uploading) {
      dragOver = true;
    }
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      processFiles(input.files);
      input.value = '';
    }
  }

  function movePhoto(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= photos.length) return;
    const newPhotos = [...photos];
    const [moved] = newPhotos.splice(fromIndex, 1);
    newPhotos.splice(toIndex, 0, moved);
    photos = newPhotos;
  }

  function openZoom(index: number) {
    zoomedPhoto = { photo: photos[index], index };
  }

  function closeZoom() {
    zoomedPhoto = null;
  }

  function handleZoomKeydown(e: KeyboardEvent) {
    if (!zoomedPhoto) return;
    if (e.key === 'Escape') {
      closeZoom();
    } else if (e.key === 'ArrowLeft' && zoomedPhoto.index > 0) {
      zoomedPhoto = { photo: photos[zoomedPhoto.index - 1], index: zoomedPhoto.index - 1 };
    } else if (e.key === 'ArrowRight' && zoomedPhoto.index < photos.length - 1) {
      zoomedPhoto = { photo: photos[zoomedPhoto.index + 1], index: zoomedPhoto.index + 1 };
    }
  }
</script>

<svelte:window onkeydown={handleZoomKeydown} />

<div class="image-uploader">
  {#if error}
    <div class="error-banner">
      <span>{error}</span>
      <button onclick={() => error = null}>&times;</button>
    </div>
  {/if}

  <div
    class="drop-zone"
    class:drag-over={dragOver}
    class:disabled={disabled || uploading || photos.length >= maxPhotos}
    ondrop={handleDrop}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    role="button"
    tabindex="0"
  >
    <input
      bind:this={fileInput}
      type="file"
      accept="image/*"
      multiple
      onchange={handleFileSelect}
      disabled={disabled || uploading || photos.length >= maxPhotos}
      class="file-input"
    />

    {#if uploading}
      <div class="upload-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {uploadProgress}%"></div>
        </div>
        <span class="progress-text">Uploading... {uploadProgress}%</span>
      </div>
    {:else if photos.length >= maxPhotos}
      <div class="max-reached">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M2 12h20"/>
        </svg>
        <span>Maximum {maxPhotos} photos reached</span>
      </div>
    {:else}
      <div class="upload-prompt">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>Drop images here or click to upload</span>
        <span class="hint">{photos.length}/{maxPhotos} photos</span>
      </div>
    {/if}
  </div>

  {#if photos.length > 0}
    <div class="photo-grid">
      {#each photos as photo, index}
        <div class="photo-item">
          <button class="photo-preview" onclick={() => openZoom(index)}>
            <img src={photo.urls.thumbnail} alt="Photo {index + 1}" />
          </button>
          <div class="photo-actions">
            {#if index > 0}
              <button class="btn-icon" onclick={() => movePhoto(index, index - 1)} title="Move left">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            {/if}
            {#if index < photos.length - 1}
              <button class="btn-icon" onclick={() => movePhoto(index, index + 1)} title="Move right">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            {/if}
            <button class="btn-icon btn-delete" onclick={() => deletePhoto(index)} title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if zoomedPhoto}
  <div class="zoom-overlay" onclick={closeZoom} role="button" tabindex="0">
    <div class="zoom-content" onclick={(e) => e.stopPropagation()}>
      <button class="btn-zoom-close" onclick={closeZoom}>
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <img src={zoomedPhoto.photo.urls.medium} alt="Zoomed" />
      <div class="zoom-controls">
        <button
          class="btn-zoom-nav"
          onclick={() => zoomedPhoto = zoomedPhoto && zoomedPhoto.index > 0 ? { photo: photos[zoomedPhoto.index - 1], index: zoomedPhoto.index - 1 } : zoomedPhoto}
          disabled={zoomedPhoto.index <= 0}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span class="zoom-counter">{zoomedPhoto.index + 1} / {photos.length}</span>
        <button
          class="btn-zoom-nav"
          onclick={() => zoomedPhoto = zoomedPhoto && zoomedPhoto.index < photos.length - 1 ? { photo: photos[zoomedPhoto.index + 1], index: zoomedPhoto.index + 1 } : zoomedPhoto}
          disabled={zoomedPhoto.index >= photos.length - 1}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .image-uploader {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .error-banner {
    background: var(--color-error);
    color: white;
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .error-banner button {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .drop-zone {
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-8);
    text-align: center;
    transition: var(--transition-fast);
    cursor: pointer;
    position: relative;
  }

  .drop-zone.drag-over {
    border-color: var(--color-primary);
    background: var(--color-primary-alpha);
  }

  .drop-zone.disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    gap: var(--spacing-2);
    color: var(--color-text-muted);
  }

  .upload-prompt svg {
    color: var(--color-text-muted);
  }

  .hint {
    font-size: var(--text-sm);
  }

  .upload-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2);
  }

  .progress-bar {
    width: 200px;
    height: 8px;
    background: var(--color-border);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s ease;
  }

  .progress-text {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .max-reached {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2);
    color: var(--color-text-muted);
  }

  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--spacing-3);
  }

  .photo-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--color-surface);
  }

  .photo-preview {
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    cursor: pointer;
    background: none;
  }

  .photo-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-actions {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0,0,0,0.7));
    padding: var(--spacing-2);
    display: flex;
    justify-content: center;
    gap: var(--spacing-1);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .photo-item:hover .photo-actions {
    opacity: 1;
  }

  .btn-icon {
    background: rgba(255,255,255,0.2);
    border: none;
    border-radius: var(--radius-md);
    padding: var(--spacing-1);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: background 0.2s;
  }

  .btn-icon:hover {
    background: rgba(255,255,255,0.3);
  }

  .btn-delete:hover {
    background: var(--color-error);
  }

  .zoom-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-4);
  }

  .zoom-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-4);
  }

  .zoom-content img {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: var(--radius-lg);
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
  }

  .btn-zoom-nav {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
    color: white;
  }

  .btn-zoom-nav:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .btn-zoom-nav:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .zoom-counter {
    color: white;
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    min-width: 80px;
    text-align: center;
  }

  .btn-zoom-close {
    position: absolute;
    top: -40px;
    right: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-2);
    color: white;
  }

  .btn-zoom-close:hover {
    color: var(--color-error);
  }

  @media (max-width: 640px) {
    .photo-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }

    .photo-actions {
      opacity: 1;
    }
  }
</style>
