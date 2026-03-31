import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const { apiClient } = await import('$lib/api/client');
  
  const [settings, userMemories, categories] = await Promise.all([
    apiClient.getSettings(),
    apiClient.getMemories(),
    apiClient.getRecipeCategories(),
  ]);
  
  return {
    memories: userMemories,
    categories,
  };
};
