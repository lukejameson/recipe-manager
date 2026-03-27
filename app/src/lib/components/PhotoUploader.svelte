<script lang="ts">
  export type CompressionLevel = 'standard' | 'high';

  const COMPRESSION_SETTINGS: Record<CompressionLevel, { maxSize: number; quality: number }> = {
    standard: { maxSize: 1920, quality: 0.85 },
    high: { maxSize: 1280, quality: 0.75 }, // Smaller images = cheaper API calls
  };

  let {
    images = $bindable([]),
    maxImages = 20,
    disabled = false,
    compressionLevel = 'standard' as CompressionLevel,
  }: {
    images: string[];
    maxImages?: number;
    disabled?: boolean;
    compressionLevel?: CompressionLevel;
  } = $props();

  let dragOver = $state(false);
  let fileInput: HTMLInputElement;
  let cameraInput: HTMLInputElement;
  let compressing = $state(false);
  let zoomedImage = $state<{ src: string; index: number } | null>(null);

  // Detect if device has camera
  const hasCamera = typeof navigator !== 'undefined' && 'mediaDevices' in navigator;

  async function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((f) => f.type.startsWith('image/'));

    const remaining = maxImages - images.length;
    const toProcess = imageFiles.slice(0, remaining);

    if (toProcess.length === 0) return;

    compressing = true;
    try {
      const settings = COMPRESSION_SETTINGS[compressionLevel];
      for (const file of toProcess) {
        const compressed = await compressImage(file, settings.maxSize, settings.quality);
        images = [...images, compressed];
      }
    } finally {
      compressing = false;
    }
  }

  /**
   * Compress image to reduce size for API calls
   * Target: max 1920px on longest side, 85% quality JPEG
   */
  async function compressImage(file: File, maxSize = 1920, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        let { width, height } = img;

        // Scale down if larger than maxSize
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }

        const compressed = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(img.src);
        resolve(compressed);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Rotate an image by 90 degrees
   */
  async function rotateImage(index: number, clockwise = true): Promise<void> {
    const image = images[index];

    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Swap dimensions for 90 degree rotation
        canvas.width = img.height;
        canvas.height = img.width;

        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Move to center and rotate
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((clockwise ? 90 : -90) * Math.PI / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
        }

        const rotated = canvas.toDataURL('image/jpeg', 0.9);
        images = images.map((im, i) => (i === index ? rotated : im));

        // Update zoomed image if it's the one being rotated
        if (zoomedImage && zoomedImage.index === index) {
          zoomedImage = { src: rotated, index };
        }

        resolve();
      };

      img.src = image;
    });
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (disabled || compressing) return;
    if (e.dataTransfer?.files) {
      processFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!disabled && !compressing) {
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

  function removeImage(index: number) {
    images = images.filter((_, i) => i !== index);
    if (zoomedImage?.index === index) {
      zoomedImage = null;
    }
  }

  function moveImage(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= images.length) return;
    const newImages = [...images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    images = newImages;
  }

  function openZoom(index: number) {
    zoomedImage = { src: images[index], index };
  }

  function closeZoom() {
    zoomedImage = null;
  }

  function handleZoomKeydown(e: KeyboardEvent) {
    if (!zoomedImage) return;

    if (e.key === 'Escape') {
      closeZoom();
    } else if (e.key === 'ArrowLeft' && zoomedImage.index > 0) {
      zoomedImage = { src: images[zoomedImage.index - 1], index: zoomedImage.index - 1 };
    } else if (e.key === 'ArrowRight' && zoomedImage.index < images.length - 1) {
      zoomedImage = { src: images[zoomedImage.index + 1], index: zoomedImage.index + 1 };
    }
  }
</script>

<svelte:window onkeydown={handleZoomKeydown} />

<div class="photo-uploader">
  <div
    class="drop-zone"
    class:drag-over={dragOver}
    class:disabled={disabled || compressing}
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
      disabled={disabled || compressing}
    />
    <input
      bind:this={cameraInput}
      type="file"
      accept="image/*"
      capture="environment"
      onchange={handleFileSelect}
      disabled={disabled || compressing}
    />

    <div class="drop-content">
      {#if compressing}
        <div class="spinner"></div>
        <p class="drop-text">Processing photos...</p>
      {:else}
        <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p class="drop-text">
          {#if disabled}
            Upload disabled
          {:else}
            Drop photos here
          {/if}
        </p>

        <div class="upload-buttons">
          <button
            type="button"
            class="btn-upload"
            onclick={() => fileInput?.click()}
            disabled={disabled || compressing}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Choose Files
          </button>

          {#if hasCamera}
            <button
              type="button"
              class="btn-camera"
              onclick={() => cameraInput?.click()}
              disabled={disabled || compressing}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Take Photo
            </button>
          {/if}
        </div>
      {/if}

      <p class="drop-hint">
        {images.length}/{maxImages} photos added
        {#if images.length > 0}
          <span class="size-hint">
            (images auto-compressed)
          </span>
        {/if}
      </p>
    </div>
  </div>

  {#if images.length > 0}
    <div class="image-grid">
      {#each images as image, index}
        <div class="image-item">
          <button
            type="button"
            class="image-button"
            onclick={() => openZoom(index)}
            disabled={disabled}
          >
            <img src={image} alt="Recipe photo {index + 1}" />
          </button>
          <div class="image-number">{index + 1}</div>
          <div class="image-actions">
            <button
              type="button"
              class="btn-action"
              onclick={() => rotateImage(index, false)}
              disabled={disabled}
              title="Rotate left"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38" />
              </svg>
            </button>
            <button
              type="button"
              class="btn-action"
              onclick={() => rotateImage(index, true)}
              disabled={disabled}
              title="Rotate right"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform: scaleX(-1)">
                <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38" />
              </svg>
            </button>
            <button
              type="button"
              class="btn-action"
              onclick={() => moveImage(index, index - 1)}
              disabled={index === 0 || disabled}
              title="Move left"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              class="btn-action"
              onclick={() => moveImage(index, index + 1)}
              disabled={index === images.length - 1 || disabled}
              title="Move right"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button
              type="button"
              class="btn-action btn-remove"
              onclick={() => removeImage(index)}
              disabled={disabled}
              title="Remove"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Zoom Modal -->
{#if zoomedImage}
  <div
    class="zoom-overlay"
    onclick={closeZoom}
    onkeydown={(e) => e.key === 'Escape' && closeZoom()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="zoom-content" onclick={(e) => e.stopPropagation()}>
      <img src={zoomedImage.src} alt="Recipe photo {zoomedImage.index + 1}" />

      <div class="zoom-controls">
        <button
          type="button"
          class="btn-zoom-nav"
          onclick={() => zoomedImage && zoomedImage.index > 0 && (zoomedImage = { src: images[zoomedImage.index - 1], index: zoomedImage.index - 1 })}
          disabled={zoomedImage.index === 0}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <span class="zoom-counter">{zoomedImage.index + 1} / {images.length}</span>

        <button
          type="button"
          class="btn-zoom-nav"
          onclick={() => zoomedImage && zoomedImage.index < images.length - 1 && (zoomedImage = { src: images[zoomedImage.index + 1], index: zoomedImage.index + 1 })}
          disabled={zoomedImage.index === images.length - 1}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div class="zoom-actions">
        <button
          type="button"
          class="btn-zoom-action"
          onclick={() => zoomedImage && rotateImage(zoomedImage.index, false)}
          title="Rotate left"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38" />
          </svg>
        </button>
        <button
          type="button"
          class="btn-zoom-action"
          onclick={() => zoomedImage && rotateImage(zoomedImage.index, true)}
          title="Rotate right"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform: scaleX(-1)">
            <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38" />
          </svg>
        </button>
      </div>

      <button type="button" class="btn-zoom-close" onclick={closeZoom}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .photo-uploader {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .drop-zone {
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-8);
    text-align: center;
    transition: var(--transition-normal);
    background: var(--color-surface);
  }

  .drop-zone:hover:not(.disabled) {
    border-color: var(--color-primary);
    background: rgba(255, 107, 53, 0.03);
  }

  .drop-zone.drag-over {
    border-color: var(--color-primary);
    background: rgba(255, 107, 53, 0.08);
    transform: scale(1.01);
  }

  .drop-zone.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .drop-zone input {
    display: none;
  }

  .drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-3);
  }

  .upload-icon {
    width: 48px;
    height: 48px;
    color: var(--color-text-light);
  }

  .drop-text {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--color-text);
    margin: 0;
  }

  .upload-buttons {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn-upload,
  .btn-camera {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-upload {
    background: var(--color-primary);
    color: white;
    border: 2px solid var(--color-primary);
  }

  .btn-upload:hover:not(:disabled) {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
  }

  .btn-camera {
    background: var(--color-surface);
    color: var(--color-text);
    border: 2px solid var(--color-border);
  }

  .btn-camera:hover:not(:disabled) {
    background: var(--color-bg-subtle);
    border-color: var(--color-text-light);
  }

  .btn-upload svg,
  .btn-camera svg {
    width: 18px;
    height: 18px;
  }

  .btn-upload:disabled,
  .btn-camera:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .drop-hint {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: 0;
  }

  .size-hint {
    color: var(--color-text-lighter);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--spacing-3);
  }

  .image-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 2px solid var(--color-border);
    background: var(--color-bg-subtle);
  }

  .image-button {
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  .image-button img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: var(--transition-fast);
  }

  .image-item:hover .image-button img {
    transform: scale(1.05);
  }

  .image-number {
    position: absolute;
    top: var(--spacing-2);
    left: var(--spacing-2);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-md);
    min-width: 24px;
    text-align: center;
  }

  .image-actions {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 2px;
    padding: var(--spacing-2);
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    opacity: 0;
    transition: var(--transition-fast);
  }

  .image-item:hover .image-actions {
    opacity: 1;
  }

  .btn-action {
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: var(--radius-sm);
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-action:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .btn-action svg {
    width: 14px;
    height: 14px;
    color: var(--color-text);
  }

  .btn-action:hover:not(:disabled) {
    background: white;
    transform: scale(1.1);
  }

  .btn-action.btn-remove:hover:not(:disabled) {
    background: #fee;
  }

  .btn-action.btn-remove:hover:not(:disabled) svg {
    color: var(--color-error);
  }

  /* Zoom Modal */
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
    transition: var(--transition-fast);
  }

  .btn-zoom-nav:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .btn-zoom-nav:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .btn-zoom-nav svg {
    width: 24px;
    height: 24px;
    color: white;
  }

  .zoom-counter {
    color: white;
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    min-width: 80px;
    text-align: center;
  }

  .zoom-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .btn-zoom-action {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: var(--radius-lg);
    padding: var(--spacing-2) var(--spacing-3);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-zoom-action:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .btn-zoom-action svg {
    width: 20px;
    height: 20px;
    color: white;
  }

  .btn-zoom-close {
    position: absolute;
    top: -40px;
    right: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-2);
  }

  .btn-zoom-close svg {
    width: 32px;
    height: 32px;
    color: white;
  }

  .btn-zoom-close:hover svg {
    color: var(--color-error);
  }

  @media (max-width: 640px) {
    .drop-zone {
      padding: var(--spacing-6);
    }

    .upload-buttons {
      flex-direction: column;
      width: 100%;
    }

    .btn-upload,
    .btn-camera {
      width: 100%;
      justify-content: center;
    }

    .image-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }

    .image-actions {
      opacity: 1;
    }

    .zoom-content img {
      max-height: 60vh;
    }
  }
</style>
