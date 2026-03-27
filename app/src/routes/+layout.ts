import { authStore } from '$lib/stores/auth.svelte';

export const ssr = false;

export async function load() {
  // Load user on app initialization
  if (typeof window !== 'undefined') {
    await authStore.loadUser();
  }

  return {};
}
