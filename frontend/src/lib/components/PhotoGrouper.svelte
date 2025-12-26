<script lang="ts">
  import { trpc } from '$lib/trpc/client';

  let {
    images,
    groups = $bindable([]),
    onExtract,
    disabled = false,
  }: {
    images: string[];
    groups: number[][];
    onExtract: (imageGroups: string[][]) => void;
    disabled?: boolean;
  } = $props();

  let analyzing = $state(false);
  let error = $state('');
  let analysisNotes = $state('');

  // Initialize with all images in one group if groups is empty
  $effect(() => {
    if (groups.length === 0 && images.length > 0) {
      groups = [images.map((_, i) => i)];
    }
  });

  async function analyzeWithAI() {
    analyzing = true;
    error = '';
    analysisNotes = '';

    try {
      const result = await trpc.recipe.analyzePhotoGroups.mutate({ images });
      groups = result.groupIndices;
      analysisNotes = result.notes;
    } catch (err: any) {
      error = err.message || 'Failed to analyze photos';
    } finally {
      analyzing = false;
    }
  }

  function splitGroup(groupIndex: number) {
    const group = groups[groupIndex];
    if (group.length <= 1) return;

    // Split into individual images
    const newGroups = [...groups];
    newGroups.splice(groupIndex, 1, ...group.map((idx) => [idx]));
    groups = newGroups;
  }

  function mergeWithNext(groupIndex: number) {
    if (groupIndex >= groups.length - 1) return;

    const newGroups = [...groups];
    const merged = [...newGroups[groupIndex], ...newGroups[groupIndex + 1]];
    newGroups.splice(groupIndex, 2, merged);
    groups = newGroups;
  }

  function mergeWithPrevious(groupIndex: number) {
    if (groupIndex <= 0) return;

    const newGroups = [...groups];
    const merged = [...newGroups[groupIndex - 1], ...newGroups[groupIndex]];
    newGroups.splice(groupIndex - 1, 2, merged);
    groups = newGroups;
  }

  function moveImageToGroup(fromGroupIndex: number, imageIndexInGroup: number, toGroupIndex: number) {
    const newGroups = [...groups];
    const imageIndex = newGroups[fromGroupIndex][imageIndexInGroup];

    // Remove from old group
    newGroups[fromGroupIndex] = newGroups[fromGroupIndex].filter((_, i) => i !== imageIndexInGroup);

    // Add to new group
    if (toGroupIndex === -1) {
      // Create new group
      newGroups.push([imageIndex]);
    } else {
      newGroups[toGroupIndex] = [...newGroups[toGroupIndex], imageIndex];
    }

    // Remove empty groups
    groups = newGroups.filter((g) => g.length > 0);
  }

  function handleExtract() {
    const imageGroups = groups.map((group) => group.map((idx) => images[idx]));
    onExtract(imageGroups);
  }

  // Drag and drop state
  let draggedItem: { groupIndex: number; imageIndex: number } | null = $state(null);
  let dragOverGroup: number | null = $state(null);

  function handleDragStart(groupIndex: number, imageIndex: number) {
    draggedItem = { groupIndex, imageIndex };
  }

  function handleDragOver(e: DragEvent, groupIndex: number) {
    e.preventDefault();
    dragOverGroup = groupIndex;
  }

  function handleDragLeave() {
    dragOverGroup = null;
  }

  function handleDrop(e: DragEvent, toGroupIndex: number) {
    e.preventDefault();
    if (draggedItem && draggedItem.groupIndex !== toGroupIndex) {
      moveImageToGroup(draggedItem.groupIndex, draggedItem.imageIndex, toGroupIndex);
    }
    draggedItem = null;
    dragOverGroup = null;
  }

  function handleDragEnd() {
    draggedItem = null;
    dragOverGroup = null;
  }
</script>

<div class="photo-grouper">
  <div class="grouper-header">
    <div class="header-info">
      <h3>Photo Groups</h3>
      <p class="hint">
        Each group will be processed as one recipe. Multi-page recipes should be in the same group.
      </p>
    </div>
    <div class="header-actions">
      <button
        type="button"
        class="btn-analyze"
        onclick={analyzeWithAI}
        disabled={analyzing || disabled || images.length < 2}
      >
        {#if analyzing}
          <span class="spinner"></span>
          Analyzing...
        {:else}
          <span class="ai-icon">AI</span>
          Auto-Group Photos
        {/if}
      </button>
    </div>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if analysisNotes}
    <div class="analysis-notes">
      <strong>AI Notes:</strong> {analysisNotes}
    </div>
  {/if}

  <div class="groups-container">
    {#each groups as group, groupIndex}
      <div
        class="recipe-group"
        class:drag-over={dragOverGroup === groupIndex}
        ondragover={(e) => handleDragOver(e, groupIndex)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, groupIndex)}
        role="region"
        aria-label="Recipe group {groupIndex + 1}"
      >
        <div class="group-header">
          <span class="group-title">
            Recipe {groupIndex + 1}
            <span class="page-count">({group.length} {group.length === 1 ? 'page' : 'pages'})</span>
          </span>
          <div class="group-actions">
            {#if groupIndex > 0}
              <button
                type="button"
                class="btn-group-action"
                onclick={() => mergeWithPrevious(groupIndex)}
                title="Merge with previous group"
                {disabled}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="17 11 12 6 7 11" />
                  <line x1="12" y1="6" x2="12" y2="18" />
                </svg>
                Merge Up
              </button>
            {/if}
            {#if groupIndex < groups.length - 1}
              <button
                type="button"
                class="btn-group-action"
                onclick={() => mergeWithNext(groupIndex)}
                title="Merge with next group"
                {disabled}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="7 13 12 18 17 13" />
                  <line x1="12" y1="18" x2="12" y2="6" />
                </svg>
                Merge Down
              </button>
            {/if}
            {#if group.length > 1}
              <button
                type="button"
                class="btn-group-action btn-split"
                onclick={() => splitGroup(groupIndex)}
                title="Split into separate recipes"
                {disabled}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
                Split
              </button>
            {/if}
          </div>
        </div>

        <div class="group-images">
          {#each group as imageIndex, idx}
            <div
              class="group-image"
              draggable="true"
              ondragstart={() => handleDragStart(groupIndex, idx)}
              ondragend={handleDragEnd}
              role="listitem"
            >
              <img src={images[imageIndex]} alt="Page {idx + 1}" />
              <div class="image-badge">{idx + 1}</div>
            </div>
          {/each}
        </div>
      </div>
    {/each}

    <!-- Drop zone for new group -->
    <div
      class="new-group-zone"
      class:drag-over={dragOverGroup === -1}
      ondragover={(e) => handleDragOver(e, -1)}
      ondragleave={handleDragLeave}
      ondrop={(e) => handleDrop(e, -1)}
      role="region"
      aria-label="Create new recipe group"
    >
      <span>Drop here to create new recipe</span>
    </div>
  </div>

  <div class="extract-section">
    <button
      type="button"
      class="btn-extract"
      onclick={handleExtract}
      disabled={disabled || groups.length === 0}
    >
      Extract {groups.length} {groups.length === 1 ? 'Recipe' : 'Recipes'}
    </button>
  </div>
</div>

<style>
  .photo-grouper {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .grouper-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-4);
    flex-wrap: wrap;
  }

  .header-info h3 {
    margin: 0 0 var(--spacing-1) 0;
    font-size: var(--text-lg);
    color: var(--color-text);
  }

  .hint {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .btn-analyze {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-4);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: var(--font-semibold);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-analyze:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-analyze:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .ai-icon {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error {
    background: #fef2f2;
    color: var(--color-error);
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
  }

  .analysis-notes {
    background: #f0f9ff;
    color: #0369a1;
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
  }

  .groups-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .recipe-group {
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    background: var(--color-surface);
    transition: var(--transition-fast);
  }

  .recipe-group.drag-over {
    border-color: var(--color-primary);
    background: rgba(255, 107, 53, 0.05);
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-3);
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .group-title {
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .page-count {
    font-weight: var(--font-normal);
    color: var(--color-text-light);
    font-size: var(--text-sm);
  }

  .group-actions {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .btn-group-action {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-group-action:hover:not(:disabled) {
    background: var(--color-border-light);
  }

  .btn-group-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-group-action svg {
    width: 14px;
    height: 14px;
  }

  .btn-split {
    color: var(--color-primary);
    border-color: var(--color-primary-light);
  }

  .btn-split:hover:not(:disabled) {
    background: rgba(255, 107, 53, 0.1);
  }

  .group-images {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .group-image {
    position: relative;
    width: 80px;
    height: 80px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 2px solid var(--color-border);
    cursor: grab;
    transition: var(--transition-fast);
  }

  .group-image:hover {
    transform: scale(1.05);
    box-shadow: var(--shadow-md);
  }

  .group-image:active {
    cursor: grabbing;
  }

  .group-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-badge {
    position: absolute;
    top: 2px;
    left: 2px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

  .new-group-zone {
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    text-align: center;
    color: var(--color-text-light);
    font-size: var(--text-sm);
    transition: var(--transition-fast);
  }

  .new-group-zone.drag-over {
    border-color: var(--color-primary);
    background: rgba(255, 107, 53, 0.08);
    color: var(--color-primary);
  }

  .extract-section {
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-border);
  }

  .btn-extract {
    width: 100%;
    padding: var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-extract:hover:not(:disabled) {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .btn-extract:disabled {
    background: var(--color-border);
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .grouper-header {
      flex-direction: column;
    }

    .group-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .group-image {
      width: 60px;
      height: 60px;
    }
  }
</style>
