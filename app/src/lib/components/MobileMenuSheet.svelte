<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import {
    FolderOpen,
    Tag,
    User,
    Settings,
    HelpCircle,
    Shield,
    LogOut,
    X,
    ShoppingCart,
    Package,
  } from 'lucide-svelte';

  interface Props {
    open: boolean;
  }

  let { open = $bindable() }: Props = $props();

  let sheetRef: HTMLDivElement | undefined = $state();

  function closeSheet() {
    open = false;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeSheet();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      closeSheet();
    }
  }

  function navigateTo(href: string) {
    goto(href);
    closeSheet();
  }

  function handleLogout() {
    authStore.logout();
    closeSheet();
  }

  // Lock body scroll when open
  $effect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="sheet-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      bind:this={sheetRef}
      class="sheet-container"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
    >
      <!-- Handle bar -->
      <div class="sheet-handle">
        <div class="handle-bar"></div>
      </div>

      <!-- Close button -->
      <button
        class="close-btn"
        onclick={closeSheet}
        aria-label="Close menu"
      >
        <X size={24} />
      </button>

      <!-- Menu sections -->
      <div class="sheet-content">
        <div class="menu-section">
          <h3>Main</h3>
          <button
            class="menu-item"
            onclick={() => navigateTo('/collections')}
          >
            <FolderOpen size={22} />
            <span>Collections</span>
          </button>
          <button
            class="menu-item"
            onclick={() => navigateTo('/shopping-list')}
          >
            <ShoppingCart size={22} />
            <span>Shopping List</span>
          </button>
          <button
            class="menu-item"
            onclick={() => navigateTo('/pantry')}
          >
            <Package size={22} />
            <span>Pantry</span>
          </button>
        </div>

        <!-- User section -->
        <div class="menu-section">
          <h3>Your Account</h3>
          <button
            class="menu-item"
            onclick={() => navigateTo('/tags')}
          >
            <Tag size={22} />
            <span>Tags</span>
          </button>
          <button
            class="menu-item"
            onclick={() => navigateTo('/profile')}
          >
            <User size={22} />
            <span>Profile</span>
          </button>
          <button
            class="menu-item"
            onclick={() => navigateTo('/settings')}
          >
            <Settings size={22} />
            <span>Settings</span>
          </button>
          <button
            class="menu-item"
            onclick={() => navigateTo('/help')}
          >
            <HelpCircle size={22} />
            <span>Help</span>
          </button>
        </div>

        <!-- Admin section -->
        {#if authStore.isAdmin}
          <div class="menu-section">
            <h3>Administration</h3>
            <button
              class="menu-item admin-item"
              onclick={() => navigateTo('/admin')}
            >
              <Shield size={22} />
              <span>Admin</span>
            </button>
          </div>
        {/if}

        <!-- Logout section -->
        <div class="menu-section logout-section">
          <button
            class="menu-item logout-item"
            onclick={handleLogout}
          >
            <LogOut size={22} />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .sheet-container {
    width: 100%;
    max-width: 600px;
    max-height: 70vh;
    background: white;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
    animation: slideUp 0.3s ease;
    position: relative;
    padding-bottom: env(safe-area-inset-bottom);
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .sheet-handle {
    display: flex;
    justify-content: center;
    padding: var(--spacing-3) 0;
  }

  .handle-bar {
    width: 40px;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
  }

  .close-btn {
    position: absolute;
    top: var(--spacing-3);
    right: var(--spacing-4);
    background: none;
    border: none;
    padding: var(--spacing-2);
    color: var(--color-text-light);
    cursor: pointer;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
  }

  .close-btn:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  .sheet-content {
    padding: 0 var(--spacing-4) var(--spacing-6);
    overflow-y: auto;
    max-height: calc(70vh - 60px);
  }

  .menu-section {
    margin-bottom: var(--spacing-4);
  }

  .menu-section h3 {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--spacing-2) 0;
    padding: 0 var(--spacing-3);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    width: 100%;
    padding: var(--spacing-3) var(--spacing-3);
    background: none;
    border: none;
    border-radius: var(--radius-lg);
    color: var(--color-text);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: background 0.15s ease;
    min-height: 52px;
    text-align: left;
  }

  .menu-item:hover {
    background: var(--color-bg-subtle);
  }

  .menu-item span {
    flex: 1;
  }

  .admin-item {
    color: #7c3aed;
  }

  .admin-item:hover {
    background: #f5f3ff;
  }

  .logout-section {
    margin-top: var(--spacing-4);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-border-light);
  }

  .logout-item {
    color: var(--color-error);
  }

  .logout-item:hover {
    background: #fef2f2;
  }

  /* Desktop: hide mobile menu sheet */
  @media (min-width: 769px) {
    .sheet-backdrop {
      display: none;
    }
  }
</style>
