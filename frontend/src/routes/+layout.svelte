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
    --color-bg: #fffbf7;
    --color-bg-subtle: #fff5ed;
    --color-surface: #ffffff;
    --color-text: #2d3436;
    --color-text-light: #636e72;
    --color-border: #ffe8d9;
    --color-shadow: rgba(255, 107, 53, 0.08);
    --color-success: #00b894;
    --color-warning: #fdcb6e;
    --color-error: #d63031;

    /* Shadows */
    --shadow-sm: 0 2px 4px var(--color-shadow);
    --shadow-md: 0 4px 12px var(--color-shadow);
    --shadow-lg: 0 8px 24px var(--color-shadow);
    --shadow-xl: 0 12px 32px var(--color-shadow);

    /* Border Radius */
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 16px;
    --radius-xl: 20px;

    /* Spacing */
    --spacing-xs: 0.5rem;
    --spacing-sm: 0.75rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;
    --spacing-2xl: 3rem;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: var(--color-bg);
    color: var(--color-text);
    line-height: 1.6;
  }

  :global(*) {
    box-sizing: border-box;
  }

  :global(h1, h2, h3, h4, h5, h6) {
    font-weight: 700;
    line-height: 1.2;
    color: var(--color-text);
  }

  :global(a) {
    color: var(--color-primary);
    transition: color 0.2s;
  }

  :global(a:hover) {
    color: var(--color-primary-dark);
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, var(--color-bg) 0%, var(--color-bg-subtle) 100%);
  }
</style>
