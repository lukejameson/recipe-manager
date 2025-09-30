<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { page } from '$app/stores';

  let { } = $props();
</script>

<header>
  <div class="container">
    <h1>
      <a href="/">🍳 Recipe Manager</a>
    </h1>

    {#if authStore.isAuthenticated}
      <nav>
        <a href="/" class:active={$page.url.pathname === '/'}>Recipes</a>
        <a href="/recipe/new" class:active={$page.url.pathname === '/recipe/new'}>New Recipe</a>
        <a href="/recipe/import" class:active={$page.url.pathname === '/recipe/import'}>Import</a>
        <button onclick={() => authStore.logout()} class="logout-btn">Logout</button>
      </nav>
    {/if}
  </div>
</header>

<style>
  header {
    background: white;
    border-bottom: 1px solid #e0e0e0;
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  h1 a {
    color: #333;
    text-decoration: none;
  }

  nav {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }

  nav a {
    color: #666;
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  nav a:hover {
    background: #f0f0f0;
  }

  nav a.active {
    color: #4a9eff;
    background: #e8f4ff;
  }

  .logout-btn {
    background: none;
    border: 1px solid #ddd;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    color: #666;
    font-size: inherit;
  }

  .logout-btn:hover {
    background: #fee;
    border-color: #fcc;
    color: #c33;
  }

  @media (max-width: 640px) {
    .container {
      flex-direction: column;
      align-items: stretch;
    }

    h1 {
      text-align: center;
    }

    nav {
      justify-content: center;
    }

    nav a,
    .logout-btn {
      flex: 1;
      text-align: center;
    }
  }
</style>
