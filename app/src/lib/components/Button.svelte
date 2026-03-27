<script lang="ts">
  import type { Component } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'icon';
    size?: 'sm' | 'md' | 'lg';
    icon?: Component;
    iconPosition?: 'left' | 'right';
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    href?: string;
    title?: string;
    class?: string;
    onclick?: (event: MouseEvent) => void;
    children?: import('svelte').Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    icon: IconComponent,
    iconPosition = 'left',
    disabled = false,
    type = 'button',
    href,
    title,
    class: className = '',
    onclick,
    children,
  }: Props = $props();

  const baseClasses = 'btn';
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;

  $effect(() => {
    if (variant === 'icon' && size === 'lg') {
      console.warn(
        'Button: icon variant with lg size is not recommended. Use md size for icon buttons.'
      );
    }
  });
</script>

{#if href}
  <a
    {href}
    class="{baseClasses} {variantClass} {sizeClass} {className}"
    {title}
    aria-disabled={disabled}
    tabindex={disabled ? -1 : 0}
  >
    {#if IconComponent && iconPosition === 'left'}
      <IconComponent />
    {/if}
    {#if children}
      <span class="btn-content">{@render children()}</span>
    {/if}
    {#if IconComponent && iconPosition === 'right'}
      <IconComponent />
    {/if}
  </a>
{:else}
  <button
    {type}
    class="{baseClasses} {variantClass} {sizeClass} {className}"
    {disabled}
    {title}
    {onclick}
  >
    {#if IconComponent && iconPosition === 'left'}
      <IconComponent />
    {/if}
    {#if children}
      <span class="btn-content">{@render children()}</span>
    {/if}
    {#if IconComponent && iconPosition === 'right'}
      <IconComponent />
    {/if}
  </button>
{/if}

<style>
  /* Base button styles */
  .btn {
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

  .btn:disabled,
  .btn[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .btn-content {
    display: inline-flex;
    align-items: center;
  }

  /* Size variants */
  .btn-sm {
    height: var(--btn-height-sm);
    padding: 0 var(--spacing-3);
    border-radius: var(--btn-radius);
    font-size: var(--text-xs);
  }

  .btn-md {
    height: var(--btn-height-md);
    padding: 0 var(--spacing-4);
    border-radius: var(--btn-radius);
    font-size: var(--text-sm);
  }

  .btn-lg {
    height: var(--btn-height-lg);
    padding: 0 var(--spacing-5);
    border-radius: var(--btn-radius);
    font-size: var(--text-base);
  }

  /* Icon-only button (square) */
  .btn-icon {
    width: var(--btn-height-md);
    height: var(--btn-height-md);
    padding: 0;
    border-radius: var(--btn-radius-icon);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    min-width: 44px;
    min-height: 44px;
  }

  .btn-icon:hover:not(:disabled) {
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border-color: var(--color-primary);
  }

  .btn-icon.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  /* Icon sizes */
  .btn-icon.btn-sm {
    width: var(--btn-height-sm);
    height: var(--btn-height-sm);
    min-width: 36px;
    min-height: 36px;
  }

  .btn-icon.btn-md {
    width: var(--btn-height-md);
    height: var(--btn-height-md);
    min-width: 44px;
    min-height: 44px;
  }

  .btn-icon.btn-lg {
    width: var(--btn-height-lg);
    height: var(--btn-height-lg);
    min-width: 52px;
    min-height: 52px;
  }

  /* Mobile: ensure minimum touch target size */
  @media (max-width: 640px) {
    .btn-icon.btn-sm {
      min-width: 44px;
      min-height: 44px;
    }
  }

  /* Primary button */
  .btn-primary {
    background: var(--btn-primary-bg);
    color: var(--btn-primary-text);
    border: 2px solid var(--btn-primary-bg);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--btn-primary-bg-hover);
    border-color: var(--btn-primary-bg-hover);
    transform: translateY(-0.5px);
    box-shadow: var(--shadow-md);
  }

  /* Secondary button */
  .btn-secondary {
    background: var(--btn-secondary-bg);
    color: var(--btn-secondary-text);
    border: 2px solid var(--btn-secondary-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--btn-secondary-bg-hover);
    transform: translateY(-0.5px);
    box-shadow: var(--shadow-md);
  }

  /* Tertiary button */
  .btn-tertiary {
    background: var(--btn-tertiary-bg);
    color: var(--btn-tertiary-text);
    border: 2px solid transparent;
  }

  .btn-tertiary:hover:not(:disabled) {
    background: var(--btn-tertiary-bg-hover);
  }

  /* Danger button */
  .btn-danger {
    background: var(--btn-danger-bg);
    color: var(--btn-danger-text);
    border: 2px solid var(--btn-danger-bg);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--btn-danger-bg-hover);
    border-color: var(--btn-danger-bg-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  /* Ensure icons in buttons are sized appropriately */
  .btn :global(svg) {
    width: 1.25em;
    height: 1.25em;
    flex-shrink: 0;
  }

  .btn-sm :global(svg) {
    width: 1em;
    height: 1em;
  }

  .btn-lg :global(svg) {
    width: 1.5em;
    height: 1.5em;
  }
</style>
