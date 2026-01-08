<script lang="ts">
  import { authStore, type UserFeatureFlags } from '$lib/stores/auth.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    feature: keyof UserFeatureFlags;
    children: Snippet;
    fallback?: Snippet;
  }

  let { feature, children, fallback }: Props = $props();

  let hasFeature = $derived(authStore.hasFeature(feature));
</script>

{#if hasFeature}
  {@render children()}
{:else if fallback}
  {@render fallback()}
{/if}
