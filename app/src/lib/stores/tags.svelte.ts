import { readable } from 'svelte/store';
import { apiClient } from '$lib/api/client';
import type { Tag } from '$lib/server/db/schema';
export const allTags = readable<Tag[]>([], (set) => {
  let cancelled = false;
  const load = async () => {
    try {
      const tags = await apiClient.getTags();
      if (!cancelled) set(tags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };
  load();
  return () => {
    cancelled = true;
  };
});
