<script lang="ts">
  import { goto } from '$app/navigation';
  import { Camera, Image } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let fileInputRef: HTMLInputElement | undefined = $state();

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      onClose();
    }
  }

  function openCamera() {
    if (fileInputRef) {
      fileInputRef.capture = 'environment';
      fileInputRef.click();
    }
  }

  function openPhotoLibrary() {
    if (fileInputRef) {
      fileInputRef.capture = '';
      fileInputRef.click();
    }
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      onClose();
      return;
    }

    // Convert to base64 and store in sessionStorage
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      sessionStorage.setItem('quickPhotoImport', base64);
      goto('/recipe/import?mode=photo');
    };
    reader.readAsDataURL(file);

    // Reset input
    input.value = '';
    onClose();
  }

  // Lock body scroll when open
  $effect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="sheet-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      class="sheet-container"
      role="dialog"
      aria-modal="true"
      aria-label="Photo import options"
    >
      <!-- Handle bar -->
      <div class="sheet-handle">
        <div class="handle-bar"></div>
      </div>

      <div class="sheet-content">
        <h3>Import Recipe from Photo</h3>

        <button class="menu-item" onclick={openCamera}>
          <Camera size={24} />
          <div class="menu-item-text">
            <span class="menu-item-title">Open Camera</span>
            <span class="menu-item-desc">Take a photo now</span>
          </div>
        </button>

        <button class="menu-item" onclick={openPhotoLibrary}>
          <Image size={24} />
          <div class="menu-item-text">
            <span class="menu-item-title">Photo Library</span>
            <span class="menu-item-desc">Choose from existing photos</span>
          </div>
        </button>
      </div>

      <!-- Hidden file input -->
      <input
        bind:this={fileInputRef}
        type="file"
        accept="image/*"
        class="hidden-input"
        onchange={handleFileSelect}
      />
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .sheet-container {
    width: 100%;
    max-width: 600px;
    background: white;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
    animation: slideUp 0.3s ease;
    position: relative;
    padding-bottom: env(safe-area-inset-bottom);
    padding-top: env(safe-area-inset-top);
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .sheet-handle {
    display: flex;
    justify-content: center;
    padding: var(--spacing-3) 0;
  }

  .handle-bar {
    width: 40px;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
  }

  .sheet-content {
    padding: 0 var(--spacing-6) var(--spacing-6);
  }

  .sheet-content h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    margin: 0 0 var(--spacing-4) 0;
    text-align: center;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    width: 100%;
    padding: var(--spacing-4);
    margin-bottom: var(--spacing-3);
    background: var(--color-bg-subtle);
    border: none;
    border-radius: var(--radius-xl);
    color: var(--color-text);
    cursor: pointer;
    transition: background 0.15s ease, transform 0.15s ease;
    min-height: 64px;
    text-align: left;
  }

  .menu-item:hover {
    background: var(--color-border-light);
    transform: translateY(-1px);
  }

  .menu-item:active {
    transform: translateY(0);
  }

  .menu-item :global(svg) {
    color: var(--color-primary);
    flex-shrink: 0;
  }

  .menu-item-text {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .menu-item-title {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .menu-item-desc {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .hidden-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 0;
    height: 0;
  }

  /* Desktop: hide mobile menu sheet */
  @media (min-width: 769px) {
    .sheet-backdrop {
      display: none;
    }
  }
</style>
