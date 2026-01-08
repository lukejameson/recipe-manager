<script lang="ts">
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';

  let {} = $props();
  let mobileMenuOpen = $state(false);
  let userMenuOpen = $state(false);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

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

<header>
  <div class="container">
    <h1>
      <a href="/" onclick={closeMobileMenu}>
        <svg
          class="logo"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
        >
          <rect width="32" height="32" rx="6" fill="#ff6b35" />
          <path
            d="M16 6c-4.4 0-8 3.6-8 8v6c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-6c0-4.4-3.6-8-8-8z"
            fill="#fff"
          />
          <ellipse cx="16" cy="8" rx="6" ry="2" fill="#fff" />
          <circle cx="12" cy="13" r="1.5" fill="#ff6b35" />
          <circle cx="16" cy="15" r="1.5" fill="#ff6b35" />
          <circle cx="20" cy="13" r="1.5" fill="#ff6b35" />
          <path d="M10 24h12v2H10z" fill="#fff" />
        </svg>
        Recipe Manager
      </a>
    </h1>

    {#if authStore.isAuthenticated}
      <!-- Mobile hamburger button -->
      <button
        class="mobile-menu-btn"
        onclick={toggleMobileMenu}
        aria-label="Toggle menu"
      >
        <span class="hamburger" class:open={mobileMenuOpen}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

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
                <span class="dropdown-icon">🏷️</span>
                Tags
              </a>
              <a href="/profile" class:active={$page.url.pathname === '/profile'} onclick={closeUserMenu}>
                <span class="dropdown-icon">👤</span>
                Profile
              </a>
              <a href="/settings" class:active={$page.url.pathname === '/settings'} onclick={closeUserMenu}>
                <span class="dropdown-icon">⚙️</span>
                Settings
              </a>
              <a href="/help" class:active={$page.url.pathname === '/help'} onclick={closeUserMenu}>
                <span class="dropdown-icon">❓</span>
                Help
              </a>

              {#if authStore.isAdmin}
                <div class="dropdown-divider"></div>
                <a href="/admin" class="admin-item" class:active={$page.url.pathname.startsWith('/admin')} onclick={closeUserMenu}>
                  <span class="dropdown-icon">🛠️</span>
                  Admin
                </a>
              {/if}

              <div class="dropdown-divider"></div>

              <button class="dropdown-logout" onclick={() => { authStore.logout(); closeUserMenu(); }}>
                <span class="dropdown-icon">🚪</span>
                Log out
              </button>
            </div>
          {/if}
        </div>
      </nav>

      <!-- Mobile navigation (slide-out menu) -->
      <nav class="mobile-nav" class:mobile-open={mobileMenuOpen}>
        <div class="mobile-section">
          <a
            href="/"
            class:active={$page.url.pathname === '/'}
            onclick={closeMobileMenu}
          >
            <span class="icon">📋</span>
            <span class="label">Recipes</span>
          </a>
          <a
            href="/recipe/import"
            class:active={$page.url.pathname === '/recipe/import'}
            onclick={closeMobileMenu}
          >
            <span class="icon">📥</span>
            <span class="label">Import</span>
          </a>
          <a
            href="/generate"
            class:active={$page.url.pathname === '/generate'}
            onclick={closeMobileMenu}
          >
            <span class="icon">✨</span>
            <span class="label">Recipe Ideas</span>
          </a>
          <a
            href="/collections"
            class:active={$page.url.pathname.startsWith('/collections')}
            onclick={closeMobileMenu}
          >
            <span class="icon">📁</span>
            <span class="label">Collections</span>
          </a>
        </div>

        <div class="mobile-section-divider"></div>

        <div class="mobile-section">
          <a
            href="/tags"
            class:active={$page.url.pathname === '/tags'}
            onclick={closeMobileMenu}
          >
            <span class="icon">🏷️</span>
            <span class="label">Tags</span>
          </a>
        </div>

        <div class="mobile-section-divider"></div>

        <div class="mobile-section">
          <a
            href="/profile"
            class:active={$page.url.pathname === '/profile'}
            onclick={closeMobileMenu}
          >
            <span class="icon">👤</span>
            <span class="label">Profile</span>
          </a>
          <a
            href="/settings"
            class:active={$page.url.pathname === '/settings'}
            onclick={closeMobileMenu}
          >
            <span class="icon">⚙️</span>
            <span class="label">Settings</span>
          </a>
          <a
            href="/help"
            class:active={$page.url.pathname === '/help'}
            onclick={closeMobileMenu}
          >
            <span class="icon">❓</span>
            <span class="label">Help</span>
          </a>
        </div>

        {#if authStore.isAdmin}
          <div class="mobile-section-divider"></div>
          <div class="mobile-section">
            <a
              href="/admin"
              class:active={$page.url.pathname.startsWith('/admin')}
              onclick={closeMobileMenu}
              class="admin-link"
            >
              <span class="icon">🛠️</span>
              <span class="label">Admin</span>
            </a>
          </div>
        {/if}

        <div class="mobile-section mobile-logout-section">
          <button
            onclick={() => {
              authStore.logout();
              closeMobileMenu();
            }}
            class="logout-btn"
          >
            <span class="icon">🚪</span>
            <span class="label">Log out</span>
          </button>
        </div>
      </nav>
    {/if}
  </div>
</header>

<style>
  header {
    background: rgba(255, 255, 255, 0.95);
    border-bottom: 1px solid var(--color-border-light);
    padding: var(--spacing-4) 0;
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
    background: var(--color-bg-subtle);
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

  .user-dropdown .admin-item {
    color: #7c3aed;
  }

  .user-dropdown .admin-item:hover {
    background: #f5f3ff;
  }

  .dropdown-icon {
    font-size: var(--text-base);
    width: 20px;
    text-align: center;
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

  /* Mobile menu button */
  .mobile-menu-btn {
    display: none;
  }

  /* Mobile navigation - hidden by default */
  .mobile-nav {
    display: none;
  }

  @media (max-width: 768px) {
    header {
      padding: var(--spacing-3) 0;
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

    /* Show mobile menu button */
    .mobile-menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      padding: var(--spacing-2);
      cursor: pointer;
      z-index: 101;
      min-height: 44px;
      min-width: 44px;
    }

    .hamburger {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 24px;
      height: 20px;
      position: relative;
    }

    .hamburger span {
      display: block;
      height: 3px;
      width: 100%;
      background: var(--color-text);
      border-radius: 2px;
      transition: all 0.3s ease;
    }

    .hamburger.open span:nth-child(1) {
      transform: rotate(45deg) translate(6px, 6px);
    }

    .hamburger.open span:nth-child(2) {
      opacity: 0;
    }

    .hamburger.open span:nth-child(3) {
      transform: rotate(-45deg) translate(6px, -6px);
    }

    /* Mobile nav slide-out */
    .mobile-nav {
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      right: -100%;
      width: 280px;
      height: 100vh;
      background: var(--color-surface);
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
      transition: right 0.3s ease;
      padding: var(--spacing-16) var(--spacing-4) var(--spacing-4);
      z-index: 100;
      overflow-y: auto;
    }

    .mobile-nav.mobile-open {
      right: 0;
    }

    .mobile-section {
      display: flex;
      flex-direction: column;
    }

    .mobile-section a,
    .mobile-section button {
      width: 100%;
      padding: var(--spacing-4);
      text-align: left;
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
      min-height: 52px;
      border-radius: var(--radius-lg);
      font-size: var(--text-base);
      color: var(--color-text);
      text-decoration: none;
      background: none;
      border: none;
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .mobile-section a:hover,
    .mobile-section button:hover {
      background: var(--color-bg-subtle);
    }

    .mobile-section a.active {
      background: var(--color-primary);
      color: white;
      font-weight: var(--font-semibold);
    }

    .mobile-section a .icon,
    .mobile-section button .icon {
      font-size: var(--text-xl);
      width: 28px;
      text-align: center;
    }

    .mobile-section-divider {
      height: 1px;
      background: var(--color-border);
      margin: var(--spacing-3) var(--spacing-4);
    }

    .mobile-logout-section {
      margin-top: auto;
      padding-top: var(--spacing-4);
      border-top: 1px solid var(--color-border);
    }

    .logout-btn {
      color: var(--color-error) !important;
    }

    .logout-btn:hover {
      background: #fef2f2 !important;
    }

    .admin-link {
      color: #7c3aed !important;
    }

    .admin-link:hover {
      background: #f5f3ff !important;
    }
  }
</style>
