<script lang="ts">
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';
  import {
    BookOpen,
    User,
    Settings,
    HelpCircle,
    LogOut,
    Tag,
    Shield,
    Download,
    Sparkles,
    FolderOpen,
    Sliders,
  } from 'lucide-svelte';

  let {} = $props();
  let userMenuOpen = $state(false);

  function toggleUserMenu() {
    userMenuOpen = !userMenuOpen;
  }

  function closeUserMenu() {
    userMenuOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      closeUserMenu();
    }
  }

</script>

<svelte:window onclick={handleClickOutside} />

<!-- Skip navigation link -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<header>
  <div class="container">
    <h1>
      <a href="/">
        <svg
          class="logo"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
        >
          <rect width="32" height="32" rx="6" fill="#8C4C3E" />
          <path
            d="M16 6c-4.4 0-8 3.6-8 8v6c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-6c0-4.4-3.6-8-8-8z"
            fill="#fff"
          />
          <ellipse cx="16" cy="8" rx="6" ry="2" fill="#fff" />
          <circle cx="12" cy="13" r="1.5" fill="#8C4C3E" />
          <circle cx="16" cy="15" r="1.5" fill="#8C4C3E" />
          <circle cx="20" cy="13" r="1.5" fill="#8C4C3E" />
          <path d="M10 24h12v2H10z" fill="#fff" />
        </svg>
        Marrow
      </a>
    </h1>

    {#if authStore.isAuthenticated}
      <!-- Desktop navigation -->
      <nav class="desktop-nav">
        <a
          href="/"
          class:active={$page.url.pathname === '/'}
        >
          Recipes
        </a>
        <a
          href="/recipe/import"
          class:active={$page.url.pathname === '/recipe/import'}
        >
          Import
        </a>
        <a
          href="/generate"
          class:active={$page.url.pathname === '/generate'}
        >
          Recipe Ideas
        </a>
        <a
          href="/collections"
          class:active={$page.url.pathname.startsWith('/collections')}
        >
          Collections
        </a>

        <!-- User menu dropdown -->
        <div class="user-menu-container">
          <button
            class="user-menu-btn"
            class:active={userMenuOpen || $page.url.pathname === '/profile' || $page.url.pathname === '/settings'}
            onclick={(e) => { e.stopPropagation(); toggleUserMenu(); }}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <span class="user-icon">
              {authStore.user?.displayName?.[0]?.toUpperCase() || authStore.user?.username?.[0]?.toUpperCase() || '?'}
            </span>
            <svg class="chevron" class:open={userMenuOpen} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
            </svg>
          </button>

          {#if userMenuOpen}
            <div class="user-dropdown">
              <a href="/tags" class:active={$page.url.pathname === '/tags'} onclick={closeUserMenu}>
                <Tag size={18} />
                Tags
              </a>
              <a href="/preferences" class:active={$page.url.pathname === '/preferences'} onclick={closeUserMenu}>
                <Sliders size={18} />
                Preferences
              </a>
              <a href="/profile" class:active={$page.url.pathname === '/profile'} onclick={closeUserMenu}>
                <User size={18} />
                Profile
              </a>
              <a href="/settings" class:active={$page.url.pathname === '/settings'} onclick={closeUserMenu}>
                <Settings size={18} />
                Settings
              </a>
              <a href="/help" class:active={$page.url.pathname === '/help'} onclick={closeUserMenu}>
                <HelpCircle size={18} />
                Help
              </a>

              {#if authStore.isAdmin}
                <div class="dropdown-divider"></div>
                <a href="/admin" class="admin-item" class:active={$page.url.pathname.startsWith('/admin')} onclick={closeUserMenu}>
                  <Shield size={18} />
                  Admin
                </a>
              {/if}

              <div class="dropdown-divider"></div>

              <button class="dropdown-logout" onclick={() => { authStore.logout(); closeUserMenu(); }}>
                <LogOut size={18} />
                Log out
              </button>
            </div>
          {/if}
        </div>
      </nav>

    {/if}
  </div>
</header>

<style>
  /* Skip link styles */
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--color-primary);
    color: white;
    padding: var(--spacing-2) var(--spacing-4);
    z-index: 1000;
    text-decoration: none;
    font-weight: var(--font-medium);
    border-radius: 0 0 var(--radius-md) 0;
    transition: top 0.2s;
  }

  .skip-link:focus {
    top: 0;
  }

  header {
    background: rgba(249, 245, 239, 0.98);
    border-bottom: 1px solid var(--color-border-light);
    padding: var(--spacing-4) 0;
    padding-top: calc(var(--spacing-4) + env(safe-area-inset-top));
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: var(--shadow-sm);
    backdrop-filter: blur(12px);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-6);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-4);
  }

  h1 {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-extrabold);
    color: var(--color-text);
    letter-spacing: -0.025em;
  }

  h1 a {
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: var(--transition-fast);
  }

  .logo {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  /* Desktop Navigation */
  .desktop-nav {
    display: flex;
    gap: var(--spacing-1);
    align-items: center;
  }

  @media (min-width: 769px) {
    .desktop-nav {
      display: flex !important;
    }
  }

  .desktop-nav > a {
    color: var(--color-text-secondary);
    text-decoration: none;
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-lg);
    transition: var(--transition-fast);
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
  }

  .desktop-nav > a:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  .desktop-nav > a.active {
    color: var(--color-primary);
    background: var(--color-primary-light);
    font-weight: var(--font-semibold);
  }

  /* User menu dropdown */
  .user-menu-container {
    position: relative;
    margin-left: var(--spacing-2);
  }

  .user-menu-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .user-menu-btn:hover,
  .user-menu-btn.active {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .user-icon {
    width: 28px;
    height: 28px;
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
  }

  .chevron {
    width: 16px;
    height: 16px;
    color: var(--color-text-light);
    transition: transform 0.2s;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .user-dropdown {
    position: absolute;
    top: calc(100% + var(--spacing-2));
    right: 0;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    min-width: 200px;
    padding: var(--spacing-2);
    z-index: 200;
  }

  .user-dropdown a,
  .user-dropdown button {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-2) var(--spacing-3);
    color: var(--color-text);
    text-decoration: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .user-dropdown a:hover,
  .user-dropdown button:hover {
    background: var(--color-bg-subtle);
  }

.user-dropdown a.active {
    background: var(--color-primary);
    color: white;
  }
  .user-dropdown a.active:hover {
    background: var(--color-primary-dark);
  }
  .user-dropdown a.active:hover {
    background: #6A8F79;
  }

  .user-dropdown a.active:hover {
    background: var(--color-primary-dark);
  }

  .user-dropdown .admin-item {
    color: #7c3aed;
  }

  .user-dropdown .admin-item:hover {
    background: #f5f3ff;
  }

  .dropdown-divider {
    height: 1px;
    background: var(--color-border);
    margin: var(--spacing-2) 0;
  }

  .dropdown-logout {
    color: var(--color-error) !important;
  }

  .dropdown-logout:hover {
    background: #fef2f2 !important;
  }

  @media (max-width: 768px) {
    header {
      display: none;
      padding: var(--spacing-3) 0;
      padding-top: calc(var(--spacing-3) + env(safe-area-inset-top));
    }

    .container {
      padding: 0 var(--spacing-4);
    }

    h1 {
      font-size: var(--text-xl);
      flex: 1;
    }

    .logo {
      width: 28px;
      height: 28px;
    }

    /* Hide desktop nav on mobile */
    .desktop-nav {
      display: none;
    }
  }
</style>
