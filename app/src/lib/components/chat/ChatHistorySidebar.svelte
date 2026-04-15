<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/client';
  import { goto } from '$app/navigation';
  import { Pencil, Search, X, Pin, MessageSquare, MoreVertical, Trash2, Check } from 'lucide-svelte';

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
  let editingSessionId = $state<string | null>(null);
  let editTitle = $state('');
  let openMenuId = $state<string | null>(null);
  let isRenaming = $state(false);
  let isDeleting = $state(false);

  onMount(async () => {
    await loadSessions();
  });

  $effect(() => {
    if (typeof document !== 'undefined') {
      if (mobileOpen) {
        document.body.classList.add('body-scroll-lock');
      } else {
        document.body.classList.remove('body-scroll-lock');
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('body-scroll-lock');
      }
    };
  });

  async function loadSessions() {
    try {
      loading = true;
      sessions = await apiClient.listChatSessions();
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      loading = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && onMobileClose) {
      onMobileClose();
    }
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
      goto(`/generate?session=${sessionId}`);
    }
  }

  async function toggleFavorite(sessionId: string, event: MouseEvent) {
    event.stopPropagation();
    try {
      sessions = sessions.map(s =>
        s.id === sessionId ? { ...s, isFavorite: !s.isFavorite } : s
      );
      await apiClient.toggleFavoriteChat(sessionId);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      await loadSessions();
    }
  }

  function toggleMenu(sessionId: string, event: MouseEvent) {
    event.stopPropagation();
    openMenuId = openMenuId === sessionId ? null : sessionId;
  }

  function closeMenu() {
    openMenuId = null;
  }

  function startEditing(session: ChatSession, event: MouseEvent) {
    event.stopPropagation();
    editingSessionId = session.id;
    editTitle = session.title;
    openMenuId = null;
    setTimeout(() => {
      const input = document.getElementById(`edit-input-${session.id}`) as HTMLInputElement;
      input?.focus();
      input?.select();
    }, 0);
  }

  function cancelEditing(event?: MouseEvent) {
    event?.stopPropagation();
    editingSessionId = null;
    editTitle = '';
  }

  async function saveRename(sessionId: string, event?: MouseEvent) {
    event?.stopPropagation();
    if (isRenaming) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      cancelEditing();
      return;
    }
    isRenaming = true;
    try {
      await apiClient.updateChatSession(sessionId, { title: trimmedTitle });
      sessions = sessions.map(s =>
        s.id === sessionId ? { ...s, title: trimmedTitle } : s
      );
      editingSessionId = null;
    } catch (error) {
      console.error('Failed to rename session:', error);
      alert('Failed to rename chat');
    } finally {
      isRenaming = false;
    }
  }

  function handleEditKeydown(e: KeyboardEvent, sessionId: string) {
    if (e.key === 'Enter') {
      saveRename(sessionId);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  }

  async function deleteSession(sessionId: string, event: MouseEvent) {
    event.stopPropagation();
    openMenuId = null;
    if (isDeleting) return;
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return;
    }
    isDeleting = true;
    try {
      await apiClient.deleteChatSession(sessionId);
      sessions = sessions.filter(s => s.id !== sessionId);
      if (sessionId === currentSessionId) {
        if (onNewChat) {
          onNewChat();
        } else {
          goto('/generate');
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete chat');
    } finally {
      isDeleting = false;
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
    
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getTimeGroup(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return 'Previous 7 Days';
    return 'Older';
  }

  let filteredSessions = $derived(
    searchQuery.trim() === '' 
      ? sessions 
      : sessions.filter(s => 
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.lastMessagePreview?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
        )
  );

  let groupedSessions = $derived(() => {
    const groups: Record<string, { favorites: ChatSession[], regular: ChatSession[] }> = {};
    
    filteredSessions.forEach(session => {
      const group = getTimeGroup(session.updatedAt);
      if (!groups[group]) {
        groups[group] = { favorites: [], regular: [] };
      }
      if (session.isFavorite) {
        groups[group].favorites.push(session);
      } else {
        groups[group].regular.push(session);
      }
    });

    const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];
    return groupOrder
      .filter(g => groups[g] && (groups[g].favorites.length > 0 || groups[g].regular.length > 0))
      .map(group => ({
        name: group,
        sessions: [...groups[group].favorites, ...groups[group].regular]
      }));
  });

  $effect(() => {
    if (currentSessionId !== undefined) {
      loadSessions();
    }
  });
</script>

<div class="sidebar desktop-sidebar">
  {@render SidebarContent()}
</div>

{#if mobileOpen}
  <div 
    class="sidebar-backdrop" 
    class:open={mobileOpen} 
    onclick={handleBackdropClick} 
    role="button" 
    tabindex="0" 
    onkeydown={(e) => e.key === 'Enter' && onMobileClose?.()} 
    aria-label="Close sidebar"
  >
    <div 
      class="sidebar mobile-sidebar" 
      class:mobile-open={mobileOpen} 
      onclick={(e) => e.stopPropagation()}
    >
      {@render SidebarContent()}
    </div>
  </div>
{/if}

{#snippet SidebarContent()}
  <div class="sidebar-header">
    <button class="btn-new-chat" onclick={handleNewChat}>
      <Pencil size={16} />
      <span>New Chat</span>
    </button>
    
    <div class="search-container">
      <div class="search-input-wrapper">
        <Search size={16} class="search-icon" />
        <input
          type="text"
          class="search-input"
          placeholder="Search chats..."
          bind:value={searchQuery}
        />
        {#if searchQuery}
          <button class="clear-search-btn" onclick={() => searchQuery = ''}>
            <X size={14} />
          </button>
        {/if}
      </div>
    </div>
  </div>

  <div class="sessions-list" onclick={closeMenu}>
    {#if loading}
      {#each [1, 2, 3, 4, 5] as _}
        <div class="session-skeleton"></div>
      {/each}
    {:else if filteredSessions.length === 0}
      <div class="empty-state">
        {#if searchQuery}
          <div class="empty-icon">
            <Search size={32} />
          </div>
          <p>No chats found for "{searchQuery}"</p>
        {:else}
          <div class="empty-icon">
            <MessageSquare size={32} />
          </div>
          <p>No chat history yet</p>
          <p class="empty-hint">Start a conversation to see it here</p>
        {/if}
      </div>
    {:else}
      {#each groupedSessions() as group}
        <div class="time-group">
          <div class="group-header">{group.name}</div>
          {#each group.sessions as session (session.id)}
            <div
              class="session-item"
              class:active={session.id === currentSessionId}
              class:editing={editingSessionId === session.id}
              onclick={() => handleSessionClick(session.id)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleSessionClick(session.id)}
            >
              <div class="session-content">
                {#if editingSessionId === session.id}
                  <div class="edit-row">
                    <input
                      id="edit-input-{session.id}"
                      type="text"
                      class="edit-input"
                      bind:value={editTitle}
                      onkeydown={(e) => handleEditKeydown(e, session.id)}
                      onclick={(e) => e.stopPropagation()}
                    />
                    <button class="edit-btn save" onclick={(e) => saveRename(session.id, e)}>
                      <Check size={14} />
                    </button>
                    <button class="edit-btn cancel" onclick={(e) => cancelEditing(e)}>
                      <X size={14} />
                    </button>
                  </div>
                {:else}
                  <div class="session-title-row">
                    <div class="session-title">{session.title}</div>
                    <div class="action-buttons">
                      {#if session.isFavorite}
                        <button
                          class="pin-btn"
                          onclick={(e) => toggleFavorite(session.id, e)}
                          title="Unpin"
                        >
                          <Pin size={12} fill="currentColor" />
                        </button>
                      {:else}
                        <button
                          class="pin-btn hidden"
                          onclick={(e) => toggleFavorite(session.id, e)}
                          title="Pin to top"
                        >
                          <Pin size={12} />
                        </button>
                      {/if}
                      <div class="menu-container">
                        <button
                          class="menu-btn hidden"
                          onclick={(e) => toggleMenu(session.id, e)}
                          title="More options"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {#if openMenuId === session.id}
                          <div class="dropdown-menu">
                            <button class="dropdown-item" onclick={(e) => startEditing(session, e)}>
                              <Pencil size={14} />
                              <span>Rename</span>
                            </button>
                            <button class="dropdown-item delete" onclick={(e) => deleteSession(session.id, e)}>
                              <Trash2 size={14} />
                              <span>Delete</span>
                            </button>
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                  {#if session.lastMessagePreview}
                    <div class="session-preview">{session.lastMessagePreview}</div>
                  {/if}
                {/if}
              </div>
              <div class="session-meta">{formatTimestamp(session.updatedAt)}</div>
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
{/snippet}

<style>
  .sidebar {
    width: 260px;
    height: 100%;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: var(--spacing-4);
    padding-top: calc(var(--spacing-4) + env(safe-area-inset-top, 0px));
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .btn-new-chat {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    background: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-new-chat:hover {
    background: var(--color-background);
    border-color: var(--color-text);
  }

  .search-container {
    position: relative;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: var(--spacing-3);
    color: var(--color-text-light);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: var(--spacing-2-5) var(--spacing-3);
    padding-left: calc(var(--spacing-3) + 24px);
    padding-right: calc(var(--spacing-3) + 24px);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    color: var(--color-text);
    transition: all 0.15s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary);
    background: var(--color-surface);
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
    transition: all 0.15s ease;
  }

  .clear-search-btn:hover {
    color: var(--color-text);
    background: var(--color-surface);
  }

  .sessions-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-2);
  }

  .time-group {
    margin-bottom: var(--spacing-4);
  }

  .group-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-light);
    padding: var(--spacing-2) var(--spacing-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--spacing-1);
  }

  .session-item {
    position: relative;
    width: 100%;
    padding: var(--spacing-3);
    margin-bottom: var(--spacing-1);
    background: transparent;
    border: none;
    border-radius: var(--radius-lg);
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-2);
  }

  .session-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .session-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-2);
  }

  .session-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .session-preview {
    font-size: 13px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.4;
  }

  .session-meta {
    font-size: 11px;
    color: var(--color-text-light);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
  }

  .session-item:hover .action-buttons,
  .session-item.active .action-buttons {
    opacity: 1;
  }

  .pin-btn {
    background: none;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .pin-btn:hover {
    color: var(--color-primary);
    background: var(--color-background);
  }

  .pin-btn:not(.hidden) {
    opacity: 1;
    color: var(--color-primary);
  }

  .session-item:hover .pin-btn.hidden {
    opacity: 0.5;
  }

  .session-item:hover .pin-btn.hidden:hover {
    opacity: 1;
  }

  .menu-container {
    position: relative;
  }

  .menu-btn {
    background: none;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: all 0.15s ease;
  }

  .menu-btn:hover {
    color: var(--color-text);
    background: var(--color-background);
  }

  .session-item:hover .menu-btn.hidden {
    opacity: 0.5;
  }

  .session-item:hover .menu-btn.hidden:hover {
    opacity: 1;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    min-width: 140px;
    padding: var(--spacing-1);
    margin-top: 4px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .dropdown-item:hover {
    background: var(--color-background);
  }

  .dropdown-item.delete {
    color: var(--color-error);
  }

  .dropdown-item.delete:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .session-item:hover {
    background: var(--color-background);
  }

  .session-item.active {
    background: var(--color-background);
  }

  .session-item.active .session-title {
    font-weight: 600;
  }

  .session-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background: var(--color-primary);
    border-radius: 0 2px 2px 0;
  }

  .edit-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    width: 100%;
  }

  .edit-input {
    flex: 1;
    padding: var(--spacing-1) var(--spacing-2);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 14px;
    outline: none;
    min-width: 0;
  }

  .edit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-1);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .edit-btn.save {
    background: var(--color-success);
    color: white;
  }

  .edit-btn.cancel {
    background: var(--color-surface);
    color: var(--color-text-light);
  }

  .edit-btn:hover {
    transform: scale(1.1);
  }

  .session-skeleton {
    height: 56px;
    margin-bottom: var(--spacing-1);
    margin-left: var(--spacing-2);
    margin-right: var(--spacing-2);
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
    padding: var(--spacing-8) var(--spacing-4);
    text-align: center;
    color: var(--color-text-secondary);
  }

  .empty-icon {
    color: var(--color-text-light);
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

  .desktop-sidebar {
    display: flex;
    height: 100%;
  }

  .mobile-sidebar {
    display: none;
    transform: translateX(-100%);
    transition: transform 0.25s ease-out;
  }

  .mobile-sidebar.mobile-open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 199;
    opacity: 0;
    transition: opacity 0.25s ease-out;
  }

  .sidebar-backdrop.open {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .desktop-sidebar {
      display: none;
    }

    .mobile-sidebar {
      display: flex;
    }

    .sidebar-backdrop {
      display: block;
    }

    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: 280px;
      height: 100vh;
      height: 100dvh;
      z-index: 200;
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
    }

    .sidebar-header {
      padding-top: calc(var(--spacing-4) + env(safe-area-inset-top, 0px));
    }

    .sessions-list {
      height: calc(100dvh - 140px - env(safe-area-inset-top, 0px));
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .search-input {
      font-size: 16px;
    }
    .session-item {
      min-height: 56px;
      user-select: none;
      -webkit-user-select: none;
    }

    .action-buttons {
      opacity: 1;
    }

    .pin-btn.hidden,
    .menu-btn.hidden {
      opacity: 0.3;
    }

    .dropdown-menu {
      position: fixed;
      top: auto;
      bottom: 100px;
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      min-width: 200px;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
    }

    .dropdown-item {
      padding: var(--spacing-3) var(--spacing-4);
      font-size: 14px;
    }
  }
</style>
