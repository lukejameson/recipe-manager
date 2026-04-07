<script lang="ts">
  import FullscreenGallery from './FullscreenGallery.svelte';
  import type { GalleryPhoto } from './FullscreenGallery.svelte';

  export type PhotoGalleryPhoto = {
    id: string;
    urls: {
      thumbnail?: string | null;
      medium?: string | null;
      original: string;
    };
    width?: number;
    height?: number;
    isMain?: boolean;
  };

  let {
    photos = $bindable([]),
    recipeId = '',
    editable = false,
    maxPhotos = 5,
    onaddphotos,
    onviewphotos
  }: {
    photos: PhotoGalleryPhoto[];
    recipeId?: string;
    editable?: boolean;
    maxPhotos?: number;
    onaddphotos?: () => void;
    onviewphotos?: () => void;
  } = $props();

  let fullscreenOpen = $state(false);
  let fullscreenIndex = $state(0);
  let mainPhoto = $derived(photos.find(p => p.isMain) || photos[0]);

  function openFullscreen(index: number) {
    fullscreenIndex = index;
    fullscreenOpen = true;
  }

  function closeFullscreen() {
    fullscreenOpen = false;
  }

  function handleSetMain(photoId: string) {
    photos = photos.map(p => ({
      ...p,
      isMain: p.id === photoId
    }));
  }

  function handleDelete(photoId: string) {
    photos = photos.filter(p => p.id !== photoId);
  }
</script>

<div class="photo-gallery">
  {#if photos.length === 0}
    <div class="gallery-empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <span>No photos yet</span>
      {#if editable && onaddphotos}
        <button type="button" class="btn-add" onclick={onaddphotos}>
          Add Photos
        </button>
      {/if}
    </div>
  {:else}
    <div class="gallery-grid">
      {#if mainPhoto}
        <button class="photo-main" onclick={() => openFullscreen(photos.indexOf(mainPhoto))}>
          <img src={mainPhoto.urls.medium || mainPhoto.urls.original} alt="Main photo" />
          {#if mainPhoto.isMain}
            <span class="main-badge">★ Main</span>
          {/if}
        </button>
      {/if}
      {#if photos.length > 1}
        <div class="photo-thumbnails">
          {#each photos.slice(0, 4) as photo, index}
            {#if index !== 0 || !photo.isMain}
              <button
                class="photo-thumb"
                class:small={photos.length > 2}
                onclick={() => openFullscreen(photos.indexOf(photo))}
              >
                <img src={photo.urls.thumbnail || photo.urls.medium} alt={`Photo ${index + 1}`} />
              </button>
            {/if}
          {/each}
          {#if photos.length > 4}
            <button
              class="photo-thumb more"
              onclick={() => openFullscreen(4)}
            >
              <span>+{photos.length - 4}</span>
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if editable}
      <div class="gallery-actions">
        {#if photos.length < maxPhotos && onaddphotos}
          <button type="button" class="btn-secondary" onclick={onaddphotos}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Photo
          </button>
        {/if}
      </div>
    {/if}
  {/if}
</div>

{#if fullscreenOpen}
  <FullscreenGallery
    photos={photos}
    initialIndex={fullscreenIndex}
    onclose={closeFullscreen}
    onselectmain={editable ? handleSetMain : undefined}
    showSetMain={editable}
  />
{/if}

<style>
  .photo-gallery {
    width: 100%;
  }

  .gallery-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-lg);
    color: var(--color-text-muted);
  }

  .gallery-empty svg {
    opacity: 0.5;
  }

  .gallery-empty span {
    font-size: 0.9rem;
  }

  .btn-add {
    margin-top: 0.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }

  .gallery-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .photo-main {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border: none;
    padding: 0;
    border-radius: var(--radius-lg);
    overflow: hidden;
    cursor: pointer;
    background: var(--color-bg-subtle);
  }

  .photo-main img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .main-badge {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    background: rgba(0, 0, 0, 0.6);
    color: #fbbf24;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .photo-thumbnails {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .photo-thumb {
    aspect-ratio: 1;
    border: none;
    padding: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    background: var(--color-bg-subtle);
  }

  .photo-thumb.small {
    aspect-ratio: 1;
  }

  .photo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-thumb.more {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .gallery-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .btn-secondary:hover {
    border-color: var(--color-primary);
  }

  @media (min-width: 640px) {
    .gallery-grid {
      flex-direction: row;
    }

    .photo-main {
      flex: 2;
      aspect-ratio: 4 / 3;
    }

    .photo-thumbnails {
      flex: 1;
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
