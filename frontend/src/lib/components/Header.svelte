<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { page } from '$app/stores';

  let { } = $props();
  let mobileMenuOpen = $state(false);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }
</script>

<header>
  <div class="container">
    <h1>
      <a href="/" onclick={closeMobileMenu}>🍳 Recipe Manager</a>
    </h1>

    {#if authStore.isAuthenticated}
      <button class="mobile-menu-btn" onclick={toggleMobileMenu} aria-label="Toggle menu">
        <span class="hamburger" class:open={mobileMenuOpen}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <nav class:mobile-open={mobileMenuOpen}>
        <a href="/" class:active={$page.url.pathname === '/'} onclick={closeMobileMenu}>
          <span class="icon">📋</span>
          <span class="label">Recipes</span>
        </a>
        <a href="/recipe/new" class:active={$page.url.pathname === '/recipe/new'} onclick={closeMobileMenu}>
          <span class="icon">➕</span>
          <span class="label">New Recipe</span>
        </a>
        <a href="/recipe/import" class:active={$page.url.pathname === '/recipe/import'} onclick={closeMobileMenu}>
          <span class="icon">📥</span>
          <span class="label">Import</span>
        </a>
        <a href="/tags" class:active={$page.url.pathname === '/tags'} onclick={closeMobileMenu}>
          <span class="icon">🏷️</span>
          <span class="label">Tags</span>
        </a>
        <a href="/collections" class:active={$page.url.pathname.startsWith('/collections')} onclick={closeMobileMenu}>
          <span class="icon">📁</span>
          <span class="label">Collections</span>
        </a>
        <a href="/shopping-list" class:active={$page.url.pathname === '/shopping-list'} onclick={closeMobileMenu}>
          <span class="icon">🛒</span>
          <span class="label">Shopping List</span>
        </a>
        <button onclick={() => { authStore.logout(); closeMobileMenu(); }} class="logout-btn">
          <span class="icon">🚪</span>
          <span class="label">Logout</span>
        </button>
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

  nav {
    display: flex;
    gap: var(--spacing-1);
    align-items: center;
    flex-wrap: wrap;
  }

  nav a {
    color: var(--color-text-secondary);
    text-decoration: none;
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-lg);
    transition: var(--transition-fast);
    font-weight: var(--font-medium);
    position: relative;
    font-size: var(--text-sm);
  }

  nav a .icon,
  nav button .icon {
    display: none;
  }

  nav a::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 50%;
    width: 0;
    height: 2px;
    background: var(--color-primary);
    transition: var(--transition-fast);
    transform: translateX(-50%);
    border-radius: var(--radius-full);
  }

  nav a:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  nav a:hover::after {
    width: 80%;
  }

  nav a.active {
    color: var(--color-primary);
    background: var(--color-bg-subtle);
    font-weight: var(--font-semibold);
  }

  nav a.active::after {
    width: 80%;
  }

  .logout-btn {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-lg);
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    transition: var(--transition-fast);
  }

  .logout-btn:hover {
    background: var(--color-error);
    border-color: var(--color-error);
    color: white;
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .mobile-menu-btn {
    display: none;
  }

  @media (max-width: 640px) {
    header {
      padding: var(--spacing-3) 0;
    }

    .container {
      flex-direction: row;
      padding: 0 var(--spacing-4);
      gap: var(--spacing-4);
    }

    h1 {
      font-size: var(--text-xl);
      flex: 1;
    }

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

    nav {
      position: fixed;
      top: 0;
      right: -100%;
      width: 280px;
      height: 100vh;
      background: var(--color-surface);
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
      transition: right 0.3s ease;
      padding: var(--spacing-16) var(--spacing-6) var(--spacing-6);
      display: flex;
      flex-direction: column;
      gap: 0;
      z-index: 100;
      overflow-y: auto;
    }

    nav.mobile-open {
      right: 0;
    }

    nav a,
    nav button {
      width: 100%;
      padding: var(--spacing-4);
      text-align: left;
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
      min-height: 56px;
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-2);
      font-size: var(--text-base);
    }

    nav a .icon,
    nav button .icon {
      display: inline;
      font-size: var(--text-xl);
      width: 32px;
      text-align: center;
      line-height: 1;
    }

    .logout-btn {
      margin-top: auto;
      border-top: 1px solid var(--color-border);
      border-radius: 0;
      padding-top: var(--spacing-6);
    }
  }

  /* Icon styling */
  .icon {
    font-style: normal;
    line-height: 1;
  }
</style>
