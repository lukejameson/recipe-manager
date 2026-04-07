<script lang="ts">
  export type GalleryPhoto = {
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
    photos = [],
    initialIndex = 0,
    onclose,
    onselectmain,
    showSetMain = false
  }: {
    photos: GalleryPhoto[];
    initialIndex?: number;
    onclose: () => void;
    onselectmain?: (photoId: string) => void;
    showSetMain?: boolean;
  } = $props();

  let currentIndex = $state(initialIndex);
  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let isDragging = $state(false);
  let startX = $state(0);
  let startY = $state(0);
  let imageLoading = $state(false);

  let currentPhoto = $derived(photos[currentIndex]);

  function close() {
    onclose();
  }

  function goNext() {
    if (currentIndex < photos.length - 1) {
      currentIndex++;
      resetTransform();
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      currentIndex--;
      resetTransform();
    }
  }

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - startX;
    const deltaY = e.touches[0].clientY - startY;

    if (Math.abs(deltaX) > Math.abs(deltaY) && scale === 1) {
      e.preventDefault();
      translateX = deltaX;
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!isDragging) return;
    isDragging = false;

    const threshold = 50;
    if (Math.abs(translateX) > threshold && scale === 1) {
      if (translateX > 0) {
        goPrev();
      } else {
        goNext();
      }
    }

    translateX = 0;
    translateY = 0;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowLeft') {
      goPrev();
    } else if (e.key === 'ArrowRight') {
      goNext();
    }
  }

  function handleSetMain() {
    if (onselectmain && currentPhoto) {
      onselectmain(currentPhoto.id);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="gallery-overlay"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="dialog"
  aria-modal="true"
  aria-label="Photo gallery"
>
  <div class="gallery-header">
    <button class="btn-close" onclick={close} aria-label="Close gallery">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <span class="counter">{currentIndex + 1} / {photos.length}</span>
    {#if showSetMain}
      <button
        class="btn-set-main"
        onclick={handleSetMain}
        disabled={currentPhoto?.isMain}
      >
        {currentPhoto?.isMain ? '★ Main' : 'Set as Main'}
      </button>
    {/if}
  </div>

  <div class="gallery-content">
    {#if currentIndex > 0}
      <button class="nav-btn nav-prev" onclick={goPrev} aria-label="Previous photo">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
    {/if}

    <div
      class="image-container"
      style="transform: translate({translateX}px, {translateY}px)"
    >
      {#if imageLoading}
        <div class="loading-spinner"></div>
      {/if}
      <img
        src={currentPhoto?.urls.medium || currentPhoto?.urls.original}
        alt="Gallery photo"
        class="gallery-image"
        class:loading={imageLoading}
        onload={() => imageLoading = false}
        onerror={() => imageLoading = false}
        style="transform: scale({scale})"
      />
    </div>

    {#if currentIndex < photos.length - 1}
      <button class="nav-btn nav-next" onclick={goNext} aria-label="Next photo">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    {/if}
  </div>

  <div class="gallery-thumbnails">
    {#each photos as photo, index}
      <button
        class="thumbnail"
        class:active={index === currentIndex}
        onclick={() => { currentIndex = index; resetTransform(); }}
      >
        <img src={photo.urls.thumbnail || photo.urls.medium || photo.urls.original} alt="" />
      </button>
    {/each}
  </div>

  <div class="gallery-dots">
    {#each photos as _, index}
      <button
        class="dot"
        class:active={index === currentIndex}
        onclick={() => { currentIndex = index; resetTransform(); }}
        aria-label={`Go to photo ${index + 1}`}
      />
    {/each}
  </div>
</div>

<style>
  .gallery-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    touch-action: pan-x;
    user-select: none;
  }

  .gallery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    padding-top: max(1rem, env(safe-area-inset-top));
    padding-left: max(1rem, env(safe-area-inset-left));
    padding-right: max(1rem, env(safe-area-inset-right));
    color: white;
    gap: 1rem;
  }

  .btn-close {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    transition: background 0.2s;
  }

  .btn-close:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .counter {
    font-size: 1rem;
    font-weight: 500;
  }

  .btn-set-main {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 22px;
    padding: 0.5rem 1rem;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-set-main:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .btn-set-main:disabled {
    color: #fbbf24;
    cursor: default;
  }

  .gallery-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .image-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    transition: transform 0.1s ease-out;
  }

  .gallery-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.2s ease-out;
  }

  .gallery-image.loading {
    opacity: 0.5;
  }

  .loading-spinner {
    position: absolute;
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    transition: background 0.2s;
    z-index: 10;
  }

  .nav-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .nav-prev {
    left: 1rem;
  }

  .nav-next {
    right: 1rem;
  }

  .gallery-thumbnails {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
    justify-content: center;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .gallery-thumbnails::-webkit-scrollbar {
    display: none;
  }

  .thumbnail {
    width: 60px;
    height: 60px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .thumbnail.active {
    border-color: white;
  }

  .thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .gallery-dots {
    display: none;
    justify-content: center;
    gap: 0.5rem;
    padding-bottom: 1rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: background 0.2s;
  }

  .dot.active {
    background: white;
  }

  @media (max-width: 640px) {
    .gallery-thumbnails {
      display: none;
    }

    .gallery-dots {
      display: flex;
    }

    .nav-btn {
      width: 48px;
      height: 48px;
    }

    .nav-prev {
      left: 0.5rem;
    }

    .nav-next {
      right: 0.5rem;
    }
  }
</style>
