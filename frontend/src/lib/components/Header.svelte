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
    background: var(--color-surface);
    border-bottom: 2px solid var(--color-border);
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(10px);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-lg);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-md);
  }

  h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 800;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  h1 a {
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  nav {
    display: flex;
    gap: var(--spacing-xs);
    align-items: center;
    flex-wrap: wrap;
  }

  nav a {
    color: var(--color-text);
    text-decoration: none;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    transition: all 0.2s;
    font-weight: 500;
    position: relative;
  }

  nav a .icon,
  nav button .icon {
    display: none;
  }

  nav a::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 2px;
    background: var(--color-primary);
    transition: all 0.2s;
    transform: translateX(-50%);
  }

  nav a:hover {
    background: var(--color-bg-subtle);
    color: var(--color-primary);
  }

  nav a:hover::after {
    width: 60%;
  }

  nav a.active {
    color: var(--color-primary);
    background: var(--color-bg-subtle);
  }

  nav a.active::after {
    width: 60%;
  }

  .logout-btn {
    background: none;
    border: 2px solid var(--color-border);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--color-text);
    font-size: inherit;
    font-weight: 500;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: var(--color-error);
    border-color: var(--color-error);
    color: white;
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .mobile-menu-btn {
    display: none;
  }

  @media (max-width: 640px) {
    header {
      padding: var(--spacing-sm) 0;
    }

    .container {
      flex-direction: row;
      padding: 0 var(--spacing-md);
      gap: var(--spacing-md);
    }

    h1 {
      font-size: 1.25rem;
      flex: 1;
    }

    .mobile-menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      padding: var(--spacing-xs);
      cursor: pointer;
      z-index: 101;
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
      padding: 4rem var(--spacing-lg) var(--spacing-lg);
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
      padding: var(--spacing-md);
      text-align: left;
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      min-height: 52px;
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-xs);
    }

    nav a .icon,
    nav button .icon {
      display: inline;
      font-size: 1.25rem;
      width: 28px;
      text-align: center;
    }

    .logout-btn {
      margin-top: auto;
      border-top: 2px solid var(--color-border);
      border-radius: 0;
      padding-top: var(--spacing-lg);
    }
  }
</style>
