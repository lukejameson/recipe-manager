<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/settings', { replaceState: true });
  });
</script>

<div class="loading">Redirecting to settings...</div>

<style>
  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-light);
  }
</style>
