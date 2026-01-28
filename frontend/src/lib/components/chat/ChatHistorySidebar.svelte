<script lang="ts">
  import { onMount } from 'svelte';
  import { trpc } from '$lib/trpc/client';
  import { goto } from '$app/navigation';

  interface ChatSession {
    id: string;
    title: string;
    agentId: string | null;
    isFavorite: boolean;
    lastMessagePreview: string | null;
    messageCount: number;
    createdAt: Date;
    updatedAt: Date;
  }

  interface Props {
    currentSessionId?: string | null;
    onNewChat?: () => void;
    onSessionSelect?: (sessionId: string) => void;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
  }

  let { currentSessionId = $bindable(null), onNewChat, onSessionSelect, mobileOpen = false, onMobileClose }: Props = $props();

  let sessions = $state<ChatSession[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isSearching = $state(false);
  let showOnlyFavorites = $state(false);

  onMount(async () => {
    await loadSessions();
  });

  async function loadSessions() {
    try {
      loading = true;
      sessions = await trpc.chatHistory.list.query({
        onlyFavorites: showOnlyFavorites || undefined,
      });
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      loading = false;
    }
  }

  function toggleFavoritesFilter() {
    showOnlyFavorites = !showOnlyFavorites;
    loadSessions();
  }

  async function performSearch(query: string) {
    if (query.length < 2) {
      await loadSessions();
      return;
    }

    try {
      isSearching = true;
      sessions = await trpc.chatHistory.search.query({
        query,
        searchIn: 'both',
      });
    } catch (error) {
      console.error('Failed to search chat sessions:', error);
    } finally {
      isSearching = false;
    }
  }

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement;
    searchQuery = target.value;

    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Debounce search
    searchDebounceTimer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
  }

  function clearSearch() {
    searchQuery = '';
    loadSessions();
  }

  function handleNewChat() {
    if (onNewChat) {
      onNewChat();
    }
  }

  function handleSessionClick(sessionId: string) {
    if (onSessionSelect) {
      onSessionSelect(sessionId);
    } else {
      // Default navigation
      goto(`/generate?session=${sessionId}`);
    }
  }

  async function toggleFavorite(sessionId: string, event: MouseEvent) {
    event.stopPropagation(); // Prevent session selection

    try {
      // Optimistic update
      sessions = sessions.map(s =>
        s.id === sessionId ? { ...s, isFavorite: !s.isFavorite } : s
      );

      // Call API
      await trpc.chatHistory.toggleFavorite.mutate({ id: sessionId });

      // Reload to get correct sorting
      await loadSessions();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // Reload on error to revert optimistic update
      await loadSessions();
    }
  }

  function formatTimestamp(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;

    // Format as date
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Separate favorites and regular sessions
  let favoriteSessions = $derived(sessions.filter(s => s.isFavorite));
  let regularSessions = $derived(sessions.filter(s => !s.isFavorite));

  // Refresh sessions when prop changes
  $effect(() => {
    if (currentSessionId !== undefined) {
      loadSessions();
    }
  });
</script>

<div class="sidebar" class:mobile-open={mobileOpen}>
  <div class="sidebar-header">
    <h2>Chat History</h2>
    {#if mobileOpen}
      <button class="btn-mobile-close" onclick={onMobileClose} title="Close sidebar" aria-label="Close sidebar">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    {/if}
    <button class="btn-new-chat" onclick={handleNewChat} title="Start a new chat">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      New Chat
    </button>

    <div class="search-container">
      <div class="search-input-wrapper">
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          class="search-input"
          placeholder="Search chats..."
          value={searchQuery}
          oninput={handleSearchInput}
        />
        {#if searchQuery}
          <button class="clear-search-btn" onclick={clearSearch} title="Clear search">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        {/if}
      </div>

      <label class="filter-checkbox">
        <input type="checkbox" bind:checked={showOnlyFavorites} onchange={toggleFavoritesFilter} />
        <span>Favorites only</span>
      </label>
    </div>
  </div>

  <div class="sessions-list">
    {#if loading || isSearching}
      <!-- Loading skeleton -->
      {#each [1, 2, 3, 4, 5] as _}
        <div class="session-skeleton"></div>
      {/each}
    {:else if sessions.length === 0}
      <!-- Empty state -->
      <div class="empty-state">
        {#if searchQuery}
          <div class="empty-icon">🔍</div>
          <p>No chats found for "{searchQuery}"</p>
          <button class="clear-search-btn-inline" onclick={clearSearch}>Clear search</button>
        {:else}
          <div class="empty-icon">💬</div>
          <p>No chat history yet</p>
          <p class="empty-hint">Start a conversation to see it here</p>
        {/if}
      </div>
    {:else}
      {#if favoriteSessions.length > 0}
        <div class="section-header">★ FAVORITES</div>
        {#each favoriteSessions as session (session.id)}
          <div
            class="session-item"
            class:active={session.id === currentSessionId}
            onclick={() => handleSessionClick(session.id)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && handleSessionClick(session.id)}
          >
            <button
              class="star-btn favorited"
              onclick={(e) => toggleFavorite(session.id, e)}
              title="Unstar"
            >
              ⭐
            </button>
            <div class="session-content">
              <div class="session-title">{session.title}</div>
            </div>
          </div>
        {/each}
      {/if}

      {#if regularSessions.length > 0}
        {#if favoriteSessions.length > 0}
          <div class="section-header">ALL CHATS</div>
        {/if}
        {#each regularSessions as session (session.id)}
          <div
            class="session-item"
            class:active={session.id === currentSessionId}
            onclick={() => handleSessionClick(session.id)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && handleSessionClick(session.id)}
          >
            <button
              class="star-btn"
              onclick={(e) => toggleFavorite(session.id, e)}
              title="Star"
            >
              ☆
            </button>
            <div class="session-content">
              <div class="session-title">{session.title}</div>
            </div>
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</div>

<style>
  .sidebar {
    width: 240px;
    height: 100%;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .sidebar-header h2 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  .btn-new-chat {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-new-chat:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
  }

  .btn-new-chat svg {
    flex-shrink: 0;
  }

  .search-container {
    margin-top: var(--spacing-3);
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: var(--spacing-3);
    color: var(--color-text-light);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    padding-left: calc(var(--spacing-3) + 20px);
    padding-right: calc(var(--spacing-3) + 20px);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    color: var(--color-text);
    transition: var(--transition-fast);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .search-input::placeholder {
    color: var(--color-text-light);
  }

  .clear-search-btn {
    position: absolute;
    right: var(--spacing-2);
    background: none;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    padding: var(--spacing-1);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
  }

  .clear-search-btn:hover {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .clear-search-btn-inline {
    margin-top: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .clear-search-btn-inline:hover {
    background: var(--color-primary-dark);
  }

  .filter-checkbox {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-top: var(--spacing-2);
    padding: var(--spacing-1);
    font-size: var(--text-sm);
    color: var(--color-text);
    cursor: pointer;
    user-select: none;
  }

  .filter-checkbox input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .filter-checkbox:hover {
    color: var(--color-primary);
  }

  .sessions-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-2);
  }

  .section-header {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-light);
    padding: var(--spacing-3) var(--spacing-2) var(--spacing-1);
    margin-top: var(--spacing-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-header:first-child {
    margin-top: 0;
  }

  .session-item {
    position: relative;
    width: 100%;
    padding: var(--spacing-2) var(--spacing-2);
    padding-left: 32px;
    margin-bottom: var(--spacing-1);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-left: 3px solid transparent;
    border-radius: var(--radius-md);
    text-align: left;
    cursor: pointer;
    transition: var(--transition-fast);
    height: 36px;
    display: flex;
    align-items: center;
  }

  .star-btn {
    position: absolute;
    left: 6px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    padding: 2px;
    line-height: 1;
    opacity: 0.3;
    transition: var(--transition-fast);
  }

  .star-btn:hover {
    opacity: 1;
    transform: translateY(-50%) scale(1.1);
  }

  .star-btn.favorited {
    opacity: 1;
  }

  .session-item:hover .star-btn {
    opacity: 0.6;
  }

  .session-item:hover .star-btn.favorited {
    opacity: 1;
  }

  .session-item:hover {
    background: var(--color-surface);
    border-left-color: var(--color-primary-light);
    transform: translateX(2px);
  }

  .session-item.active {
    background: var(--color-surface);
    border-left-color: var(--color-primary);
    border-color: var(--color-border);
    transform: translateX(2px);
  }

  .session-item.active .session-title {
    font-weight: 600;
  }

  .session-content {
    flex: 1;
    min-width: 0;
  }

  .session-title {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1;
  }

  .session-skeleton {
    height: 36px;
    margin-bottom: var(--spacing-1);
    background: linear-gradient(
      90deg,
      var(--color-background) 25%,
      var(--color-surface) 50%,
      var(--color-background) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-lg);
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-6) var(--spacing-4);
    text-align: center;
    color: var(--color-text-secondary);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-3);
    opacity: 0.5;
  }

  .empty-state p {
    margin: var(--spacing-1) 0;
    font-size: var(--text-sm);
  }

  .empty-hint {
    font-size: var(--text-xs);
    color: var(--color-text-light);
  }

  /* Scrollbar styling */
  .sessions-list::-webkit-scrollbar {
    width: 4px;
  }

  .sessions-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .sessions-list::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }

  .sessions-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-light);
  }

  /* Mobile Close Button */
  .btn-mobile-close {
    position: absolute;
    top: var(--spacing-3);
    right: var(--spacing-3);
    width: 44px;
    height: 44px;
    display: none;
    align-items: center;
    justify-content: center;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 50%;
    color: var(--color-text);
    cursor: pointer;
    transition: var(--transition-fast);
    z-index: 10;
  }

  .btn-mobile-close:hover {
    background: var(--color-surface);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  /* Mobile Styles */
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      top: 0;
      left: -100%;
      width: 280px;
      height: 100vh;
      z-index: 200;
      box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sidebar.mobile-open {
      left: 0;
    }

    .btn-mobile-close {
      display: flex;
    }

    .sidebar-header {
      padding-top: calc(var(--spacing-4) + 60px);
    }
  }
</style>
