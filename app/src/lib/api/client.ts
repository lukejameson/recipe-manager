import type { User, UserFeatureFlags } from '$lib/stores/auth.svelte';

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const error = new Error(errorData.error || `HTTP ${response.status}`);
    // Attach status code for error handling
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
}

export const apiClient = {
  // Auth
  login: (username: string, password: string, rememberMe?: boolean) =>
    api<{ success: boolean; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    }),

  register: (username: string, password: string, inviteCode: string, email?: string, displayName?: string) =>
    api<{ success: boolean; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, inviteCode, email, displayName }),
    }),

  logout: () => api<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => api<User>('/api/auth/me'),

  updateProfile: (data: { email?: string | null; displayName?: string | null }) =>
    api<{ success: boolean }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api<{ success: boolean }>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getSessions: () =>
    api<Array<{
      id: string;
      userAgent: string | null;
      ipAddress: string | null;
      createdAt: Date;
      lastActiveAt: Date;
      expiresAt: Date;
      isCurrent: boolean;
    }>>('/api/auth/sessions'),

  revokeSession: (sessionId: string) =>
    api<{ success: boolean }>(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' }),

  revokeAllOtherSessions: () =>
    api<{ success: boolean }>('/api/auth/sessions', { method: 'DELETE' }),

  deleteAccount: (data: { password: string }) =>
    api<{ success: boolean }>('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  // Recipes
  getRecipes: (filters?: { search?: string; tag?: string; favorite?: boolean; sortBy?: string; categoryId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.sortBy) params.set('sortBy', filters.sortBy);
    if (filters?.categoryId) params.set('categoryId', filters.categoryId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api<Array<import('$lib/server/db/schema').Recipe & { tags: string[] }>>(`/api/recipes${query}`);
  },

  getRecipe: (id: string) =>
    api<import('$lib/server/db/schema').Recipe & { tags: string[]; components: any[] }>(`/api/recipes/${id}`),

  createRecipe: (data: any) =>
    api<import('$lib/server/db/schema').Recipe & { tags: string[] }>('/api/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRecipe: (id: string, data: any) =>
    api<import('$lib/server/db/schema').Recipe & { tags: string[] }>(`/api/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  checkDuplicateRecipe: (title: string, sourceUrl?: string) =>
    api<{ exists: boolean; recipe?: import('$lib/server/db/schema').Recipe & { tags: string[] } }>(`/api/recipes/check-duplicate?title=${encodeURIComponent(title)}${sourceUrl ? `&sourceUrl=${encodeURIComponent(sourceUrl)}` : ''}`),

  deleteRecipe: (id: string) =>
    api<{ success: boolean }>(`/api/recipes/${id}`, { method: 'DELETE' }),

  // Tags
  getTags: () =>
    api<Array<import('$lib/server/db/schema').Tag & { recipeCount: number }>>('/api/tags'),

  getTagsAsCollections: () =>
    api<Array<{ id: string; name: string; description: string; recipeCount: number }>>('/api/tags/collections'),

  getTagRecipes: (tagId: string) =>
    api<{ id: string; name: string; description: string; recipes: any[] }>(`/api/tags/${tagId}/recipes`),

  createTag: (name: string) =>
    api<import('$lib/server/db/schema').Tag & { recipeCount: number }>('/api/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateTag: (id: string, name: string) =>
    api<import('$lib/server/db/schema').Tag>(`/api/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  deleteTag: (id: string) =>
    api<{ success: boolean }>(`/api/tags/${id}`, { method: 'DELETE' }),

  mergeTags: (sourceTagId: string, targetTagId: string) =>
    api<{ success: boolean; deletedCount: number; deletedTags: string[] }>('/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceTagId, targetTagId }),
    }),

  cleanupOrphanedTags: () =>
    api<{ success: boolean; deletedCount: number; deletedTags: string[] }>('/api/tags/cleanup', {
      method: 'POST',
    }),

  // Collections
  getCollections: () =>
    api<Array<import('$lib/server/db/schema').Collection & { recipeCount: number }>>('/api/collections'),

  getCollection: (id: string) =>
    api<import('$lib/server/db/schema').Collection & { recipes: any[] }>(`/api/collections/${id}`),

  createCollection: (name: string, description?: string) =>
    api<import('$lib/server/db/schema').Collection & { recipeCount: number }>('/api/collections', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  updateCollection: (id: string, data: { name?: string; description?: string }) =>
    api<import('$lib/server/db/schema').Collection>(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCollection: (id: string) =>
    api<{ success: boolean }>(`/api/collections/${id}`, { method: 'DELETE' }),

  addRecipeToCollection: (collectionId: string, recipeId: string) =>
    api<{ success: boolean }>(`/api/collections/${collectionId}/recipes`, {
      method: 'POST',
      body: JSON.stringify({ recipeId }),
    }),

  removeRecipeFromCollection: (collectionId: string, recipeId: string) =>
    api<{ success: boolean }>(`/api/collections/${collectionId}/recipes/${recipeId}`, {
      method: 'DELETE',
    }),
  getRecipeCategories: () =>
    api<Array<{ id: string; name: string; iconName: string | null; sortOrder: number; tagPatterns: string[]; isDefault: boolean; tags: Array<{ id: string; name: string }> }>>('/api/recipe-categories'),
  createRecipeCategory: (data: { name: string; iconName?: string; tagIds?: string[]; tagPatterns?: string[] }) =>
    api<{ id: string; name: string; iconName: string | null; sortOrder: number; tagPatterns: string[]; isDefault: boolean; tags: Array<{ id: string; name: string }> }>('/api/recipe-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRecipeCategory: (id: string, data: { name?: string; iconName?: string; sortOrder?: number; tagIds?: string[]; tagPatterns?: string[]; isDefault?: boolean }) =>
    api<{ id: string; name: string; iconName: string | null; sortOrder: number; tagPatterns: string[]; isDefault: boolean; tags: Array<{ id: string; name: string }> }>(`/api/recipe-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteRecipeCategory: (id: string) =>
    api<{ success: boolean }>(`/api/recipe-categories/${id}`, { method: 'DELETE' }),
  addTagsToCategory: (categoryId: string, tagIds: string[]) =>
    api<{ success: boolean }>(`/api/recipe-categories/${categoryId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagIds }),
    }),
  removeTagFromCategory: (categoryId: string, tagId: string) =>
    api<{ success: boolean }>(`/api/recipe-categories/${categoryId}/tags/${tagId}`, {
      method: 'DELETE',
    }),
  getShoppingList: () =>
    api<import('$lib/server/db/schema').ShoppingListItem[]>('/api/shopping-list'),

  addShoppingListItem: (data: { ingredient: string; quantity?: string; category?: string; recipeId?: string }) =>
    api<import('$lib/server/db/schema').ShoppingListItem>('/api/shopping-list', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateShoppingListItem: (id: string, data: { isChecked?: boolean; ingredient?: string; quantity?: string; category?: string }) =>
    api<import('$lib/server/db/schema').ShoppingListItem>(`/api/shopping-list/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteShoppingListItem: (id: string) =>
    api<{ success: boolean }>(`/api/shopping-list/${id}`, { method: 'DELETE' }),

  clearShoppingList: (checkedOnly?: boolean) =>
    api<{ success: boolean }>(`/api/shopping-list${checkedOnly ? '?checked=true' : ''}`, { method: 'DELETE' }),

  toggleShoppingListItem: (id: string) =>
    api<import('$lib/server/db/schema').ShoppingListItem>(`/api/shopping-list/${id}/toggle`, { method: 'POST' }),

  generateShoppingListFromRecipes: (data: { recipeIds: string[] }) =>
    api<import('$lib/server/db/schema').ShoppingListItem[]>('/api/shopping-list/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Settings
  getSettings: () =>
    api<{
      hasApiKey: boolean;
      hasPexelsApiKey: boolean;
      model: string;
      secondaryModel: string;
      availableModels: Array<{ id: string; name: string }>;
      isAdmin: boolean;
    }>('/api/settings'),

  updateSettings: (data: {
    anthropicApiKey?: string;
    anthropicModel?: string;
    anthropicSecondaryModel?: string;
    pexelsApiKey?: string;
  }) =>
    api<{ success: boolean }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  testApiKey: (apiKey: string) =>
    api<{ valid: boolean; error?: string }>('/api/settings/test-api-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),

  fetchModels: (apiKey: string) =>
    api<{ models: Array<{ id: string; name: string }> }>('/api/settings/fetch-models', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),

  // Multi-Provider AI Settings
  getProviders: () =>
    api<{
      providers: Array<{ id: string; name: string; supportsVision: boolean; supportsStreaming: boolean }>;
      configured: Array<{ id: string; providerId: string; baseUrl: string | null; isEnabled: boolean; createdAt: Date; updatedAt: Date; hasApiKey: boolean }>;
      unconfigured: Array<{ id: string; name: string; supportsVision: boolean; supportsStreaming: boolean }>;
    }>('/api/settings/providers'),

  addProvider: (data: { providerId: string; apiKey: string; baseUrl?: string; isEnabled?: boolean }) =>
    api<{ success: boolean; id: string; message: string }>('/api/settings/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteProvider: (providerId: string) =>
    api<{ success: boolean; message: string }>(`/api/settings/providers?providerId=${encodeURIComponent(providerId)}`, {
      method: 'DELETE',
    }),

  testProvider: (data: { providerId: string; apiKey: string; baseUrl?: string }) =>
    api<{ valid: boolean; error?: string; models?: Array<{ id: string; name: string; contextWindow: number; supportsVision: boolean; supportsJsonMode: boolean }> }>('/api/settings/test-provider', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  fetchProviderModels: (providerId: string) =>
    api<{ models: Array<{ id: string; name: string; contextWindow: number; supportsVision: boolean; supportsJsonMode: boolean }> }>(`/api/settings/models/${providerId}`),

  getFeatureConfigs: () =>
    api<{
      features: Array<{
        id: string;
        name: string;
        description: string;
        category: string;
        categoryName: string;
        requiresVision: boolean;
        defaultTemperature: number;
        defaultMaxTokens: number;
        config: {
          id: string;
          providerId: string;
          modelId: string;
          temperature: number;
          maxTokens: number;
          enabled: boolean;
          priority: number;
        } | null;
      }>;
      providers: Array<{ providerId: string; isEnabled: boolean }>;
    }>('/api/settings/feature-configs'),

  updateFeatureConfig: (data: {
    featureId: string;
    providerId: string;
    modelId: string;
    temperature?: number;
    maxTokens?: number;
    isEnabled?: boolean;
    priority?: number;
  }) =>
    api<{ success: boolean; id: string; message: string }>('/api/settings/feature-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteFeatureConfig: (featureId: string) =>
    api<{ success: boolean; message: string }>(`/api/settings/feature-configs?featureId=${encodeURIComponent(featureId)}`, {
      method: 'DELETE',
    }),

  // Memories
  getMemories: () =>
    api<import('$lib/server/db/schema').Memory[]>('/api/settings/memories'),

  createMemory: (content: string) =>
    api<import('$lib/server/db/schema').Memory>('/api/settings/memories', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  updateMemory: (id: string, data: { enabled?: boolean; content?: string }) =>
    api<import('$lib/server/db/schema').Memory>(`/api/settings/memories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteMemory: (id: string) =>
    api<{ success: boolean }>(`/api/settings/memories/${id}`, { method: 'DELETE' }),

  // AI
  getAIFlags: () =>
    api<{
      aiChat: boolean;
      recipeGeneration: boolean;
      tagSuggestions: boolean;
      nutritionCalc: boolean;
      photoExtraction: boolean;
      urlImport: boolean;
      imageSearch: boolean;
    }>('/api/ai/flags'),

  generateRecipe: (prompt: string) =>
    api<any>('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  calculateNutrition: (data: { ingredients: string[]; servings: number; title?: string }) =>
    api<any>('/api/ai/calculate-nutrition', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  suggestTags: (data: { recipe: any; existingTags: string[] }) =>
    api<any>('/api/ai/suggest-tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  chatAboutRecipe: (data: { recipe: any; messages: any[] }) =>
    api<any>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  suggestImprovements: (data: { recipe: any }) =>
    api<any>('/api/ai/suggest-improvements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  saveImprovementIdeas: (data: { id: string; improvementIdeas: any[] }) =>
    api<any>('/api/ai/save-improvement-ideas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  applyImprovements: (data: { recipe: any; improvements: string[] }) =>
    api<any>('/api/ai/apply-improvements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  adaptRecipe: (data: { recipe: any; adaptationType: string }) =>
    api<any>('/api/ai/adapt-recipe', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  suggestSubstitutions: (data: { ingredient: string; context?: string }) =>
    api<any>('/api/ai/suggest-substitutions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  explainTechnique: (data: { term: string; context?: string }) =>
    api<{ term: string; definition: string; steps?: string[]; tips?: string[] }>('/api/ai/explain-technique', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPersonalizedSuggestions: () =>
    api<{ suggestions: string[] }>('/api/ai/personalized-suggestions'),

  searchRecipesForMention: (data: { query: string; limit?: number }) =>
    api<Array<{ id: string; title: string; description?: string | null; ingredients: string[]; instructions: string[]; prepTime?: number | null; cookTime?: number | null; servings?: number | null }>>('/api/ai/search-recipes-mention', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recipeChat: (data: { messages: any[]; agentId?: string; referencedRecipes?: any[] }) =>
    api<{ message: string; recipe?: any }>('/api/ai/recipe-chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  findMatchingRecipes: (data: { availableIngredients: string[]; recipes: any[] }) =>
    api<Array<{ recipeId: string; matchScore: number; matchedIngredients: string[]; missingIngredients: string[] }>>('/api/ai/find-matching-recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  searchRecipeImages: (data: { query: string; tags?: string[]; page?: number }) =>
    api<{ images: Array<{ url: string; photographer: string; photographerUrl: string }> }>('/api/recipes/search-images', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Recipe extras
  getComponents: (recipeId: string) =>
    api<any[]>(`/api/recipes/${recipeId}/components`),

  getRelatedRecipes: (id: string, limit?: number) =>
    api<any[]>(`/api/recipes/${id}/related?limit=${limit || 6}`),

  toggleFavorite: (id: string) =>
    api<any>(`/api/recipes/${id}/favorite`, { method: 'POST' }),

  updateRating: (id: string, data: { rating?: number; notes?: string }) =>
    api<any>(`/api/recipes/${id}/rating`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  markAsCooked: (id: string) =>
    api<any>(`/api/recipes/${id}/cooked`, { method: 'POST' }),

  getHierarchy: (recipeId: string) =>
    api<any[]>(`/api/recipes/${recipeId}/hierarchy`),

  getAggregatedNutrition: (recipeId: string) =>
    api<any>(`/api/recipes/${recipeId}/nutrition`),

  setComponents: (recipeId: string, components: any[]) =>
    api<any>(`/api/recipes/${recipeId}/components`, {
      method: 'POST',
      body: JSON.stringify({ components }),
    }),

  fetchFromUrl: (url: string, convertToMetric?: boolean) =>
    api<any>('/api/recipes/import-url', {
      method: 'POST',
      body: JSON.stringify({ url, convertToMetric }),
    }),

  importJsonLd: (jsonld: string) =>
    api<any>('/api/recipes/import-jsonld', {
      method: 'POST',
      body: JSON.stringify({ jsonld }),
    }),

  bulkExtractFromPhotos: (imageGroups: string[][]) =>
    api<{ recipes: any[] }>('/api/recipes/bulk-extract-from-photos', {
      method: 'POST',
      body: JSON.stringify({ imageGroups }),
    }),

  extractFromPhotos: (images: string[]) =>
    api<any>('/api/recipes/extract-from-photos', {
      method: 'POST',
      body: JSON.stringify({ images }),
    }),

  bulkCreate: (recipes: any[]) =>
    api<any>('/api/recipes/bulk', {
      method: 'POST',
      body: JSON.stringify({ recipes }),
    }),

  searchImages: (data: { query: string; tags?: string[]; page?: number }) =>
    api<any>('/api/recipes/search-images', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  analyzePhotoGroups: (data: { images: string[] }) =>
    api<any>('/api/recipes/analyze-photo-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Agents
  getAgents: () =>
    api<import('$lib/server/db/schema').Agent[]>('/api/agents'),

  createAgent: (data: { name: string; description?: string; systemPrompt: string; icon: string; modelId?: string }) =>
    api<import('$lib/server/db/schema').Agent>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAgent: (data: { id: string; name: string; description?: string; systemPrompt: string; icon: string; modelId?: string }) =>
    api<import('$lib/server/db/schema').Agent>(`/api/agents/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAgent: (id: string) =>
    api<{ success: boolean }>(`/api/agents/${id}`, { method: 'DELETE' }),

  // Chat History
  getChatSessions: () =>
    api<import('$lib/server/db/schema').ChatSession[]>('/api/chat-history'),

  getChatSession: (data: { id: string }) =>
    api<{ session: import('$lib/server/db/schema').ChatSession; messages: import('$lib/server/db/schema').ChatMessage[] }>(`/api/chat-history/${data.id}`),

  createChatSession: (data: { title: string; agentId?: string }) =>
    api<import('$lib/server/db/schema').ChatSession>('/api/chat-history', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addChatMessage: (data: { sessionId: string; role: string; content: string; images?: string[]; referencedRecipes?: any[]; generatedRecipe?: any }) =>
    api<import('$lib/server/db/schema').ChatMessage>('/api/chat-history/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteChatMessage: (data: { messageId: string }) =>
    api<{ success: boolean }>(`/api/chat-history/messages/${data.messageId}`, { method: 'DELETE' }),

  listChatSessions: (params?: { onlyFavorites?: boolean }) => {
    const query = params?.onlyFavorites ? '?onlyFavorites=true' : '';
    return api<any[]>(`/api/chat-history${query}`);
  },

  searchChatSessions: (params: { query: string; searchIn?: string }) => {
    const query = new URLSearchParams();
    query.set('query', params.query);
    if (params.searchIn) query.set('searchIn', params.searchIn);
    return api<any[]>(`/api/chat-history/search?${query.toString()}`);
  },

  toggleFavoriteChat: (id: string) =>
    api<any>(`/api/chat-history/${id}/favorite`, { method: 'POST' }),
  deleteChatSession: (id: string) =>
    api<{ success: boolean }>(`/api/chat-history/${id}`, { method: 'DELETE' }),
  updateChatSession: (id: string, data: { title: string }) =>
    api<import('$lib/server/db/schema').ChatSession>(`/api/chat-history/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  // Admin
  getAdminUsers: () =>
    api<Array<{
      id: string;
      username: string;
      email: string | null;
      displayName: string | null;
      isAdmin: boolean;
      featureFlags: UserFeatureFlags;
      createdAt: Date;
      lastLoginAt: Date | null;
    }>>('/api/admin/users'),

  getAdminInvites: () =>
    api<Array<{
      id: string;
      code: string;
      createdBy: string;
      createdByUsername: string;
      usedBy: string | null;
      usedByUsername: string | null;
      usedAt: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      isUsed: boolean;
      isExpired: boolean;
    }>>('/api/admin/invites'),

  createAdminInvite: (expiresInDays?: number) =>
    api<import('$lib/server/db/schema').InviteCode>('/api/admin/invites', {
      method: 'POST',
      body: JSON.stringify(expiresInDays ? { expiresInDays } : {}),
    }),

  deleteInviteCode: (codeId: string) =>
    api<{ success: boolean }>(`/api/admin/invites/${codeId}`, { method: 'DELETE' }),

  updateUserFeatures: (userId: string, featureFlags: Record<string, boolean>) =>
    api<{ success: boolean }>(`/api/admin/users/${userId}/features`, {
      method: 'PUT',
      body: JSON.stringify({ featureFlags }),
    }),

  toggleAdmin: (userId: string, isAdmin: boolean) =>
    api<{ success: boolean }>(`/api/admin/users/${userId}/admin`, {
      method: 'PUT',
      body: JSON.stringify({ isAdmin }),
    }),

  deleteUser: (userId: string) =>
    api<{ success: boolean }>(`/api/admin/users/${userId}`, { method: 'DELETE' }),

  getAuditLogs: (params?: { limit?: number; offset?: number; action?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.action) searchParams.set('action', params.action);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return api<{ logs: any[]; total: number }>(`/api/admin/audit-logs${query}`);
  },

  getAuditLogActions: () =>
    api<string[]>('/api/admin/audit-logs/actions'),

  // Health
  health: () =>
    api<{ status: string; timestamp: string }>('/api/health'),
};
