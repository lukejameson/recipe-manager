<script lang="ts">
  import { apiClient } from '$lib/api/client';

  export type InstructionPhotoData = {
    id: string;
    urls: {
      thumbnail?: string | null;
      medium?: string | null;
      original: string;
    };
    width?: number;
    height?: number;
  };

  let {
    recipeId,
    instructionId,
    photo = null,
    editable = false,
    onattach,
    ondetach,
    onview
  }: {
    recipeId: string;
    instructionId: string;
    photo?: InstructionPhotoData | null;
    editable?: boolean;
    onattach?: () => void;
    ondetach?: () => void;
    onview?: (photo: InstructionPhotoData) => void;
  } = $props();

  let loading = $state(false);
  let pickerOpen = $state(false);

  async function handleAttach(photos: any[]) {
    if (photos.length === 0) return;
    const selectedPhoto = photos[0];
    loading = true;
    try {
      await apiClient.attachInstructionPhoto(recipeId, instructionId, selectedPhoto.id);
      pickerOpen = false;
      if (onattach) onattach();
    } catch (err) {
      console.error('Failed to attach photo:', err);
    } finally {
      loading = false;
    }
  }

  async function handleDetach() {
    loading = true;
    try {
      await apiClient.detachInstructionPhoto(recipeId, instructionId);
      if (ondetach) ondetach();
    } catch (err) {
      console.error('Failed to detach photo:', err);
    } finally {
      loading = false;
    }
  }

  function handleView() {
    if (photo && onview) {
      onview(photo);
    }
  }
</script>

<div class="instruction-photo">
  {#if photo}
    <button
      class="photo-attached"
      onclick={handleView}
      disabled={!onview}
    >
      <img src={photo.urls.thumbnail || photo.urls.medium || photo.urls.original} alt="Instruction photo" />
      {#if editable}
        <button
          class="btn-detach"
          onclick|stopPropagation={handleDetach}
          disabled={loading}
        >
          ×
        </button>
      {/if}
    </button>
  {:else if editable}
    <button
      class="btn-attach"
      onclick={() => pickerOpen = true}
      disabled={loading}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      Attach Photo
    </button>
  {/if}
</div>

{#if pickerOpen}
  <div class="picker-backdrop" onclick={() => pickerOpen = false} role="dialog" aria-modal="true">
    <div class="picker-modal" onclick={(e) => e.stopPropagation()}>
      <div class="picker-header">
        <h4>Attach Photo to Step</h4>
        <button class="btn-close" onclick={() => pickerOpen = false}>×</button>
      </div>
      <div class="picker-body">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          class="file-input"
          onchange={async (e) => {
            const input = e.target as HTMLInputElement;
            if (input.files?.length) {
              const file = input.files[0];
              loading = true;
              try {
                const { uploadUrl, publicUrl, storageKey, maxSizeBytes } = await apiClient.getUploadUrl(file.name, file.type);
                if (file.size > maxSizeBytes) {
                  alert('File too large');
                  return;
                }
                await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
                const photo = await apiClient.confirmUpload(storageKey, file.type, file.size);
                await handleAttach([{
                  id: photo.id,
                  urls: { original: publicUrl }
                }]);
              } catch (err) {
                console.error('Upload failed:', err);
              } finally {
                loading = false;
              }
            }
          }}
        />
        <div class="upload-prompt">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Take photo or choose from gallery</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .instruction-photo {
    display: flex;
    align-items: flex-start;
  }

  .photo-attached {
    position: relative;
    width: 80px;
    height: 80px;
    border: none;
    padding: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    background: var(--color-bg-subtle);
  }

  .photo-attached img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .btn-detach {
    position: absolute;
    top: -6px;
    right: -6px;
    background: var(--color-error);
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-attach {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--color-bg-subtle);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
  }

  .btn-attach:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-attach:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .picker-modal {
    background: white;
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 320px;
    overflow: hidden;
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .picker-header h4 {
    margin: 0;
    font-size: 1rem;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-text-light);
    padding: 0;
  }

  .picker-body {
    padding: 1rem;
    position: relative;
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
    padding: 2rem;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .upload-prompt span {
    font-size: 0.9rem;
  }
</style>
