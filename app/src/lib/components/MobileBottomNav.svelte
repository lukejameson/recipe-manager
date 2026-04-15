<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import {
    BookOpen,
    Camera,
    Plus,
    MessageSquare,
    Menu,
  } from 'lucide-svelte';
  import MobileMenuSheet from './MobileMenuSheet.svelte';
  import PhotoPickerSheet from './PhotoPickerSheet.svelte';

  let menuOpen = $state(false);
  let photoPickerOpen = $state(false);

  const navItems = [
    { icon: BookOpen, label: 'Recipes', href: '/' },
    { icon: Camera, label: 'Photo', action: 'photo' },
    { icon: null, label: 'New Recipe', href: '/recipe/new', isCenter: true },
    { icon: MessageSquare, label: 'Ideas', href: '/generate' },
    { icon: Menu, label: 'Menu', action: 'menu' },
  ];

  function handleNavClick(item: typeof navItems[number]) {
    if (item.action === 'menu') {
      menuOpen = true;
    } else if (item.action === 'photo') {
      photoPickerOpen = true;
    } else if (item.href) {
      goto(item.href);
    }
  }

  function isActive(item: typeof navItems[number]): boolean {
    if (item.action === 'menu' || item.action === 'photo') return false;
    if (!item.href) return false;
    return $page.url.pathname === item.href ||
      (item.href !== '/' && $page.url.pathname.startsWith(item.href));
  }
</script>

{#if authStore.isAuthenticated}
  <nav class="mobile-bottom-nav" aria-label="Mobile navigation">
    {#each navItems as item}
      {#if item.isCenter}
        <!-- Center elevated button -->
        <button
          class="nav-item nav-item-center"
          onclick={() => handleNavClick(item)}
          aria-label={item.label}
        >
          <div class="center-button">
            <Plus size={28} />
          </div>
        </button>
      {:else}
        <button
          class="nav-item"
          class:active={isActive(item)}
          onclick={() => handleNavClick(item)}
          aria-label={item.label}
          aria-current={isActive(item) ? 'page' : undefined}
        >
          {#if item.icon}
            <svelte:component this={item.icon} size={24} />
          {/if}
        </button>
      {/if}
    {/each}
  </nav>

  <MobileMenuSheet bind:open={menuOpen} />
  <PhotoPickerSheet bind:open={photoPickerOpen} onClose={() => photoPickerOpen = false} />
{/if}

<style>
  .mobile-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 64px;
    height: calc(64px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: white;
    border-top: 1px solid var(--color-border-light);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
    z-index: 100;
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    padding-top: env(safe-area-inset-top);
  }

  .nav-item {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 48px;
    background: none;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    transition: color 0.2s ease;
    min-height: 44px;
    padding: 0;
  }

  .nav-item:hover {
    color: var(--color-text);
  }

  .nav-item.active {
    color: var(--color-primary);
  }

  .nav-item-center {
    position: relative;
  }

.center-button {
    width: 56px;
    height: 56px;
    background: var(--color-primary);
    color: white;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(224, 122, 82, 0.4);
    transform: translateY(-12px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .center-button:hover {
    transform: translateY(-14px);
    box-shadow: 0 6px 16px rgba(224, 122, 82, 0.5);
  }
  .center-button:active {
    transform: translateY(-10px);
    box-shadow: 0 2px 8px rgba(224, 122, 82, 0.4);
  }

  .center-button:hover {
    transform: translateY(-14px);
    box-shadow: 0 6px 16px rgba(224, 122, 82, 0.5);
  }

  .center-button:active {
    transform: translateY(-10px);
    box-shadow: 0 2px 8px rgba(224, 122, 82, 0.4);
  }

  /* Desktop: hide mobile nav */
  @media (min-width: 769px) {
    .mobile-bottom-nav {
      display: none;
    }
  }
</style>
