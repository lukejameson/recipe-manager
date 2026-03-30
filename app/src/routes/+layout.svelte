<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import MobileBottomNav from '$lib/components/MobileBottomNav.svelte';

  let { children } = $props();

  onMount(() => {
    // Redirect to login if not authenticated and not on login page
    const isLoginPage = $page.url.pathname === '/login';
    if (!authStore.isAuthenticated && !isLoginPage) {
      goto('/login');
    }
  });
</script>

<div class="app">
  <main class="main-content">
    {@render children()}
  </main>
  <MobileBottomNav />
</div>

<style>
  :global(:root) {
    /* Terra & Sage Color Palette - Brightened */
    --color-primary: #E07A52;
    --color-primary-dark: #C55A38;
    --color-primary-light: #F0A080;
    --color-secondary: #E07A52;
    --color-accent: #6B9E7C;
    --color-bg: #FDF9F3;
    --color-bg-subtle: #F7F2EA;
    --color-surface: #ffffff;
    --color-text: #2D2D2D;
    --color-text-secondary: #4A4A4A;
    --color-text-light: #7A8B94;
    --color-border: #D5D5D5;
    --color-border-light: #E5E0D8;
    --color-shadow: rgba(45, 45, 45, 0.08);
    --color-success: #6B9E7C;
    --color-warning: #D4A84B;
    --color-error: #C84B4B;

    /* Enhanced Shadows */
    --shadow-xs: 0 1px 2px rgba(45, 45, 45, 0.05);
    --shadow-sm: 0 1px 3px rgba(45, 45, 45, 0.1), 0 1px 2px rgba(45, 45, 45, 0.06);
    --shadow-md: 0 4px 6px rgba(45, 45, 45, 0.07), 0 2px 4px rgba(45, 45, 45, 0.06);
    --shadow-lg: 0 10px 15px rgba(45, 45, 45, 0.1), 0 4px 6px rgba(45, 45, 45, 0.05);
    --shadow-xl: 0 20px 25px rgba(45, 45, 45, 0.1), 0 8px 10px rgba(45, 45, 45, 0.04);
    --shadow-2xl: 0 25px 50px rgba(45, 45, 45, 0.25);

    /* Modern Border Radius */
    --radius-xs: 4px;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --radius-2xl: 20px;
    --radius-3xl: 24px;
    --radius-full: 9999px;

    /* Enhanced Spacing Scale */
    --spacing-0: 0;
    --spacing-px: 1px;
    --spacing-0-5: 0.125rem;
    --spacing-1: 0.25rem;
    --spacing-1-5: 0.375rem;
    --spacing-2: 0.5rem;
    --spacing-2-5: 0.625rem;
    --spacing-3: 0.75rem;
    --spacing-3-5: 0.875rem;
    --spacing-4: 1rem;
    --spacing-5: 1.25rem;
    --spacing-6: 1.5rem;
    --spacing-7: 1.75rem;
    --spacing-8: 2rem;
    --spacing-9: 2.25rem;
    --spacing-10: 2.5rem;
    --spacing-12: 3rem;
    --spacing-16: 4rem;
    --spacing-20: 5rem;
    --spacing-24: 6rem;

    /* Typography Scale */
    --text-xs: 0.75rem;
    --text-sm: 0.875rem;
    --text-base: 1rem;
    --text-lg: 1.125rem;
    --text-xl: 1.25rem;
    --text-2xl: 1.5rem;
    --text-3xl: 1.875rem;
    --text-4xl: 2.25rem;
    --text-5xl: 3rem;

    /* Line Heights */
    --leading-tight: 1.25;
    --leading-snug: 1.375;
    --leading-normal: 1.5;
    --leading-relaxed: 1.625;
    --leading-loose: 2;

    /* Font Weights */
    --font-light: 300;
    --font-normal: 400;
    --font-medium: 500;
    --font-semibold: 600;
    --font-bold: 700;
    --font-extrabold: 800;

    /* Transitions */
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);

    /* Button System */
    /* Sizing - minimum 44px for accessibility */
    --btn-height-sm: 36px;
    --btn-height-md: 44px;
    --btn-height-lg: 52px;

    /* Padding */
    --btn-padding-x: var(--spacing-4);
    --btn-padding-y: 0; /* Height-controlled */

    /* Radius */
    --btn-radius: var(--radius-lg);
    --btn-radius-icon: var(--radius-md);

    /* Primary button */
    --btn-primary-bg: var(--color-primary);
    --btn-primary-bg-hover: var(--color-primary-dark);
    --btn-primary-text: white;

    /* Secondary button */
    --btn-secondary-bg: transparent;
    --btn-secondary-bg-hover: var(--color-primary-light);
    --btn-secondary-border: var(--color-primary);
    --btn-secondary-text: var(--color-primary);

    /* Tertiary button */
    --btn-tertiary-bg: transparent;
    --btn-tertiary-bg-hover: var(--color-bg-subtle);
    --btn-tertiary-text: var(--color-text-secondary);

    /* Danger button */
    --btn-danger-bg: var(--color-error);
    --btn-danger-bg-hover: #B53F3F;
    --btn-danger-text: white;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: var(--color-bg);
    color: var(--color-text);
    line-height: var(--leading-normal);
    font-size: var(--text-base);
    font-weight: var(--font-normal);
    text-rendering: optimizeLegibility;
  }

  :global(*) {
    box-sizing: border-box;
  }

  :global(h1, h2, h3, h4, h5, h6) {
    font-weight: var(--font-bold);
    line-height: var(--leading-tight);
    color: var(--color-text);
    margin: 0;
    letter-spacing: -0.025em;
  }

  :global(h1) {
    font-size: var(--text-4xl);
    font-weight: var(--font-extrabold);
  }

  :global(h2) {
    font-size: var(--text-3xl);
    font-weight: var(--font-bold);
  }

  :global(h3) {
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
  }

  :global(h4) {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
  }

  :global(h5) {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
  }

  :global(h6) {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
  }

  :global(p) {
    margin: 0 0 var(--spacing-4) 0;
    color: var(--color-text-secondary);
    line-height: var(--leading-relaxed);
  }

  :global(a) {
    color: var(--color-primary);
    text-decoration: none;
    transition: var(--transition-fast);
    font-weight: var(--font-medium);
  }

  :global(a:hover) {
    color: var(--color-primary-dark);
  }

  :global(a:focus) {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Global button reset and base styles */
  :global(button) {
    font-family: inherit;
  }

  :global(.btn-primary),
  :global(.btn-secondary),
  :global(.btn-tertiary),
  :global(.btn-danger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    font-weight: var(--font-semibold);
    text-decoration: none;
    cursor: pointer;
    transition: var(--transition-fast);
    border: none;
    white-space: nowrap;
    line-height: 1;
  }

  :global(.btn-primary:disabled),
  :global(.btn-secondary:disabled),
  :global(.btn-tertiary:disabled),
  :global(.btn-danger:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Icon-only button base */
  :global(.btn-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--btn-height-md);
    height: var(--btn-height-md);
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border-radius: var(--btn-radius-icon);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  :global(.btn-icon:hover:not(:disabled)) {
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border-color: var(--color-primary);
  }

  :global(.btn-icon.active) {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  /* Button variant colors */
  :global(.btn-primary) {
    background: transparent;
    color: var(--color-text);
    border: none;
  }

  :global(.btn-primary:hover:not(:disabled)) {
    color: var(--color-primary);
    transform: translateY(-1px);
  }

  :global(.btn-secondary) {
    background: transparent;
    color: var(--color-text);
    border: none;
  }

  :global(.btn-secondary:hover:not(:disabled)) {
    color: var(--color-primary);
    transform: translateY(-1px);
  }

  :global(.btn-tertiary) {
    background: var(--btn-tertiary-bg);
    color: var(--btn-tertiary-text);
    border: 2px solid transparent;
  }

  :global(.btn-tertiary:hover:not(:disabled)) {
    background: var(--btn-tertiary-bg-hover);
  }

  :global(.btn-danger) {
    background: var(--btn-danger-bg);
    color: var(--btn-danger-text);
    border: 2px solid var(--btn-danger-bg);
  }

  :global(.btn-danger:hover:not(:disabled)) {
    background: var(--btn-danger-bg-hover);
    border-color: var(--btn-danger-bg-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  /* Button sizes */
  :global(.btn-sm) {
    height: var(--btn-height-sm);
    padding: 0 var(--spacing-3);
    border-radius: var(--btn-radius);
    font-size: var(--text-xs);
  }

  :global(.btn-md) {
    height: var(--btn-height-md);
    padding: 0 var(--spacing-4);
    border-radius: var(--btn-radius);
    font-size: var(--text-sm);
  }

  :global(.btn-lg) {
    height: var(--btn-height-lg);
    padding: 0 var(--spacing-5);
    border-radius: var(--btn-radius);
    font-size: var(--text-base);
  }

  /* Icon button sizes */
  :global(.btn-icon.btn-sm) {
    width: var(--btn-height-sm);
    height: var(--btn-height-sm);
    min-width: 36px;
    min-height: 36px;
  }

  :global(.btn-icon.btn-md) {
    width: var(--btn-height-md);
    height: var(--btn-height-md);
    min-width: 44px;
    min-height: 44px;
  }

  :global(.btn-icon.btn-lg) {
    width: var(--btn-height-lg);
    height: var(--btn-height-lg);
    min-width: 52px;
    min-height: 52px;
  }

  /* Mobile: ensure minimum touch target size for icon buttons */
  @media (max-width: 640px) {
    :global(.btn-icon.btn-sm) {
      min-width: 44px;
      min-height: 44px;
    }
  }

  /* Body scroll lock for modals and sidebars */
  :global(.body-scroll-lock) {
    overflow: hidden;
    touch-action: none;
  }

  .main-content {
    flex: 1;
  }

  /* Mobile bottom nav content padding */
  @media (max-width: 768px) {
    .main-content {
      padding-bottom: calc(64px + env(safe-area-inset-bottom));
    }
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
  }
</style>
