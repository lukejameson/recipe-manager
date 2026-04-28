<script lang="ts">
  let { children } = $props();
</script>

<div class="share-layout">
  {@render children()}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
    background: #f9f5ef;
    color: #363636;
    line-height: 1.5;
  }

  .share-layout {
    min-height: 100vh;
    padding: var(--spacing-4, 1rem);
  }
</style>