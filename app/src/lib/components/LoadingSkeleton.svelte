<script lang="ts">
  interface Props {
    variant?: 'card' | 'list' | 'text' | 'avatar' | 'image' | 'recipe-detail';
    count?: number;
    lines?: number;
    width?: string;
    height?: string;
    viewMode?: 'grid' | 'list' | 'compact';
  }

  let {
    variant = 'text',
    count = 1,
    lines = 3,
    width,
    height,
    viewMode = 'grid',
  }: Props = $props();

  function getArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }
</script>

{#if variant === 'card'}
  <div
    class="skeleton-grid"
    class:view-list={viewMode === 'list'}
    class:view-compact={viewMode === 'compact'}
    aria-busy="true"
    aria-label="Loading recipes"
    role="status"
  >
    {#each getArray(count) as i (i)}
      <div class="skeleton-card">
        <div class="skeleton-image"></div>
        <div class="skeleton-content">
          <div class="skeleton-title"></div>
          <div class="skeleton-description"></div>
          <div class="skeleton-description" style="width: 60%;"></div>
          <div class="skeleton-meta">
            <div class="skeleton-badge"></div>
            <div class="skeleton-badge"></div>
          </div>
          <div class="skeleton-tags">
            <div class="skeleton-tag"></div>
            <div class="skeleton-tag"></div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{:else if variant === 'list'}
  <div
    class="skeleton-list"
    aria-busy="true"
    aria-label="Loading list"
    role="status"
  >
    {#each getArray(count) as i (i)}
      <div class="skeleton-list-item">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-list-content">
          <div class="skeleton-line" style="width: 40%;"></div>
          <div class="skeleton-line" style="width: 70%;"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if variant === 'text'}
  <div
    class="skeleton-text"
    aria-busy="true"
    aria-label="Loading content"
    role="status"
  >
    {#each getArray(lines) as i (i)}
      <div
        class="skeleton-line"
        style="width: {i === lines - 1 ? '60%' : '100%'};"
      ></div>
    {/each}
  </div>
{:else if variant === 'avatar'}
  <div
    class="skeleton-avatar"
    style="width: {width || '48px'}; height: {height || '48px'};"
    aria-busy="true"
    aria-label="Loading avatar"
    role="status"
  ></div>
{:else if variant === 'image'}
  <div
    class="skeleton-image-placeholder"
    style="width: {width || '100%'}; height: {height || '200px'};"
    aria-busy="true"
    aria-label="Loading image"
    role="status"
  ></div>
{:else if variant === 'recipe-detail'}
  <div
    class="skeleton-recipe-detail"
    aria-busy="true"
    aria-label="Loading recipe"
    role="status"
  >
    <!-- Header -->
    <div class="skeleton-header">
      <div class="skeleton-back"></div>
      <div class="skeleton-actions">
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
      </div>
    </div>

    <!-- Hero Image -->
    <div class="skeleton-hero-image"></div>

    <!-- Title and Meta -->
    <div class="skeleton-title-section">
      <div class="skeleton-main-title"></div>
      <div class="skeleton-meta-row">
        <div class="skeleton-meta-item"></div>
        <div class="skeleton-meta-item"></div>
        <div class="skeleton-meta-item"></div>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="skeleton-two-column">
      <!-- Left: Ingredients -->
      <div class="skeleton-column">
        <div class="skeleton-section-title"></div>
        {#each getArray(8) as i (i)}
          <div class="skeleton-ingredient" style="width: {70 + (i % 3) * 10}%;"></div>
        {/each}
      </div>

      <!-- Right: Instructions -->
      <div class="skeleton-column">
        <div class="skeleton-section-title"></div>
        {#each getArray(4) as i (i)}
          <div class="skeleton-instruction">
            <div class="skeleton-step-number"></div>
            <div class="skeleton-step-content">
              <div class="skeleton-line"></div>
              <div class="skeleton-line" style="width: 80%;"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Base shimmer animation */
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .skeleton-card,
    .skeleton-list-item,
    .skeleton-text,
    .skeleton-avatar,
    .skeleton-image-placeholder,
    .skeleton-recipe-detail,
    .skeleton-image,
    .skeleton-title,
    .skeleton-description,
    .skeleton-badge,
    .skeleton-tag,
    .skeleton-line,
    .skeleton-back,
    .skeleton-button,
    .skeleton-hero-image,
    .skeleton-main-title,
    .skeleton-meta-item,
    .skeleton-section-title,
    .skeleton-ingredient,
    .skeleton-instruction,
    .skeleton-step-number,
    .skeleton-step-content {
      animation: none !important;
      background: var(--color-bg-subtle) !important;
    }
  }

  /* Shared skeleton element styles */
  .skeleton-card,
  .skeleton-list-item,
  .skeleton-avatar,
  .skeleton-image-placeholder,
  .skeleton-image,
  .skeleton-title,
  .skeleton-description,
  .skeleton-badge,
  .skeleton-tag,
  .skeleton-line,
  .skeleton-back,
  .skeleton-button,
  .skeleton-hero-image,
  .skeleton-main-title,
  .skeleton-meta-item,
  .skeleton-section-title,
  .skeleton-ingredient,
  .skeleton-instruction,
  .skeleton-step-number,
  .skeleton-step-content {
    background: linear-gradient(
      90deg,
      var(--color-bg-subtle) 25%,
      var(--color-border-light) 50%,
      var(--color-bg-subtle) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-radius: var(--radius-md);
  }

  /* Card Grid Layout */
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--spacing-6);
  }

  .skeleton-grid.view-list {
    grid-template-columns: 1fr;
    gap: var(--spacing-3);
  }

  .skeleton-grid.view-compact {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--spacing-4);
  }

  .skeleton-card {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border-light);
    display: flex;
    flex-direction: column;
  }

  .skeleton-grid.view-list .skeleton-card {
    flex-direction: row;
    align-items: center;
  }

  .skeleton-grid.view-list .skeleton-image {
    width: 140px;
    height: 140px;
    flex-shrink: 0;
  }

  .skeleton-grid.view-list .skeleton-content {
    flex: 1;
  }

  .skeleton-image {
    width: 100%;
    height: 220px;
    border-radius: 0;
    animation-delay: 0ms;
  }

  .skeleton-grid.view-compact .skeleton-image {
    height: 160px;
  }

  .skeleton-content {
    padding: var(--spacing-6);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .skeleton-grid.view-compact .skeleton-content {
    padding: var(--spacing-4);
  }

  .skeleton-title {
    height: 24px;
    width: 80%;
    border-radius: var(--radius-sm);
    animation-delay: 100ms;
  }

  .skeleton-description {
    height: 16px;
    width: 100%;
    border-radius: var(--radius-sm);
    animation-delay: 150ms;
  }

  .skeleton-meta {
    display: flex;
    gap: var(--spacing-4);
    margin-top: var(--spacing-2);
  }

  .skeleton-badge {
    height: 14px;
    width: 60px;
    border-radius: var(--radius-full);
    animation-delay: 200ms;
  }

  .skeleton-tags {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
    margin-top: var(--spacing-2);
  }

  .skeleton-tag {
    height: 24px;
    width: 60px;
    border-radius: var(--radius-full);
    animation-delay: 250ms;
  }

  /* List Layout */
  .skeleton-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .skeleton-list-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-light);
  }

  .skeleton-list-item .skeleton-avatar {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
    animation-delay: 0ms;
  }

  .skeleton-list-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  /* Text Layout */
  .skeleton-text {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .skeleton-line {
    height: 16px;
    border-radius: var(--radius-sm);
  }

  /* Avatar */
  .skeleton-avatar {
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  /* Image Placeholder */
  .skeleton-image-placeholder {
    border-radius: var(--radius-lg);
  }

  /* Recipe Detail Skeleton */
  .skeleton-recipe-detail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
    animation: none;
    background: transparent;
  }

  .skeleton-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .skeleton-back {
    width: 120px;
    height: 40px;
    border-radius: var(--radius-lg);
  }

  .skeleton-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .skeleton-button {
    width: 100px;
    height: 40px;
    border-radius: var(--radius-lg);
    animation-delay: 50ms;
  }

  .skeleton-hero-image {
    width: 100%;
    height: 400px;
    border-radius: var(--radius-xl);
    animation-delay: 100ms;
  }

  .skeleton-title-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .skeleton-main-title {
    height: 40px;
    width: 60%;
    border-radius: var(--radius-md);
    animation-delay: 150ms;
  }

  .skeleton-meta-row {
    display: flex;
    gap: var(--spacing-4);
  }

  .skeleton-meta-item {
    height: 20px;
    width: 80px;
    border-radius: var(--radius-sm);
    animation-delay: 200ms;
  }

  .skeleton-two-column {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: var(--spacing-8);
  }

  @media (max-width: 768px) {
    .skeleton-two-column {
      grid-template-columns: 1fr;
      gap: var(--spacing-6);
    }
  }

  .skeleton-column {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .skeleton-section-title {
    height: 28px;
    width: 120px;
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-2);
    animation-delay: 250ms;
  }

  .skeleton-ingredient {
    height: 20px;
    border-radius: var(--radius-sm);
    animation-delay: 300ms;
  }

  .skeleton-instruction {
    display: flex;
    gap: var(--spacing-3);
    align-items: flex-start;
    background: transparent;
    animation: none;
  }

  .skeleton-step-number {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
    animation-delay: 350ms;
  }

  .skeleton-step-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    background: transparent;
    animation: none;
  }

  .skeleton-step-content .skeleton-line {
    animation-delay: 400ms;
  }

  /* Mobile styles */
  @media (max-width: 640px) {
    .skeleton-grid {
      grid-template-columns: 1fr !important;
      gap: var(--spacing-4);
    }

    .skeleton-grid.view-list .skeleton-card {
      flex-direction: column;
    }

    .skeleton-grid.view-list .skeleton-image {
      width: 100%;
      height: 180px;
    }

    .skeleton-hero-image {
      height: 250px;
    }

    .skeleton-main-title {
      width: 80%;
    }

    .skeleton-header {
      flex-wrap: wrap;
      gap: var(--spacing-2);
    }

    .skeleton-actions {
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .skeleton-button {
      width: 80px;
      height: 36px;
    }
  }
</style>
