<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

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
  {@render children()}
</div>

<style>
  :global(:root) {
    /* Modern Food-Inspired Color Palette */
    --color-primary: #ff6b35;
    --color-primary-dark: #e85a2a;
    --color-primary-light: #ff8557;
    --color-secondary: #f7931e;
    --color-accent: #2ec4b6;
    --color-bg: #fefcf9;
    --color-bg-subtle: #faf7f2;
    --color-surface: #ffffff;
    --color-text: #1a1a1a;
    --color-text-secondary: #475569;
    --color-text-light: #64748b;
    --color-border: #e2e8f0;
    --color-border-light: #f1f5f9;
    --color-shadow: rgba(15, 23, 42, 0.08);
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-error: #ef4444;

    /* Enhanced Shadows */
    --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.05);
    --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.1), 0 1px 2px rgba(15, 23, 42, 0.06);
    --shadow-md: 0 4px 6px rgba(15, 23, 42, 0.07), 0 2px 4px rgba(15, 23, 42, 0.06);
    --shadow-lg: 0 10px 15px rgba(15, 23, 42, 0.1), 0 4px 6px rgba(15, 23, 42, 0.05);
    --shadow-xl: 0 20px 25px rgba(15, 23, 42, 0.1), 0 8px 10px rgba(15, 23, 42, 0.04);
    --shadow-2xl: 0 25px 50px rgba(15, 23, 42, 0.25);

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

  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    overflow: hidden;
  }
</style>
