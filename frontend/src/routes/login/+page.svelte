<script lang="ts">
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';

  // Form mode
  let mode = $state<'login' | 'register'>('login');

  // Shared fields
  let username = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  // Registration-only fields
  let inviteCode = $state('');
  let confirmPassword = $state('');
  let email = $state('');
  let displayName = $state('');

  function resetForm() {
    username = '';
    password = '';
    inviteCode = '';
    confirmPassword = '';
    email = '';
    displayName = '';
    error = '';
  }

  function switchMode(newMode: 'login' | 'register') {
    mode = newMode;
    resetForm();
  }

  async function handleLogin() {
    error = '';
    loading = true;

    try {
      const result = await trpc.auth.login.mutate({ username, password });

      authStore.setToken(result.token);
      authStore.setUser(result.user);
      goto('/');
    } catch (err: any) {
      error = err.message || 'Authentication failed';
    } finally {
      loading = false;
    }
  }

  async function handleRegister() {
    error = '';

    // Validate passwords match
    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    // Validate password length
    if (password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }

    loading = true;

    try {
      const result = await trpc.auth.register.mutate({
        username,
        password,
        inviteCode: inviteCode.toUpperCase(),
        email: email || undefined,
        displayName: displayName || undefined,
      });

      authStore.setToken(result.token);
      authStore.setUser(result.user);
      goto('/');
    } catch (err: any) {
      error = err.message || 'Registration failed';
    } finally {
      loading = false;
    }
  }

  function handleSubmit() {
    if (mode === 'login') {
      handleLogin();
    } else {
      handleRegister();
    }
  }
</script>

<div class="login-container">
  <div class="login-box">
    <h1>Recipe Manager</h1>

    <div class="mode-tabs">
      <button
        class="mode-tab"
        class:active={mode === 'login'}
        onclick={() => switchMode('login')}
        type="button"
      >
        Login
      </button>
      <button
        class="mode-tab"
        class:active={mode === 'register'}
        onclick={() => switchMode('register')}
        type="button"
      >
        Register
      </button>
    </div>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      {#if mode === 'register'}
        <div class="form-group">
          <label for="inviteCode">Invite Code</label>
          <input
            id="inviteCode"
            type="text"
            bind:value={inviteCode}
            required
            placeholder="Enter your invite code"
            autocomplete="off"
            maxlength="8"
            style="text-transform: uppercase;"
          />
          <span class="hint">Required to create an account</span>
        </div>
      {/if}

      <div class="form-group">
        <label for="username">Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          required
          placeholder="Enter username"
          autocomplete="username"
          minlength={mode === 'register' ? 3 : undefined}
          maxlength={mode === 'register' ? 50 : undefined}
        />
        {#if mode === 'register'}
          <span class="hint">3-50 characters, letters, numbers, underscores, hyphens</span>
        {/if}
      </div>

      {#if mode === 'register'}
        <div class="form-group">
          <label for="email">Email <span class="optional">(optional)</span></label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="Enter email"
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="displayName">Display Name <span class="optional">(optional)</span></label>
          <input
            id="displayName"
            type="text"
            bind:value={displayName}
            placeholder="Enter display name"
            autocomplete="name"
            maxlength="100"
          />
        </div>
      {/if}

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          placeholder="Enter password"
          autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
          minlength={mode === 'register' ? 8 : undefined}
        />
        {#if mode === 'register'}
          <span class="hint">Minimum 8 characters</span>
        {/if}
      </div>

      {#if mode === 'register'}
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            required
            placeholder="Confirm password"
            autocomplete="new-password"
          />
        </div>
      {/if}

      <button type="submit" disabled={loading}>
        {#if loading}
          {mode === 'login' ? 'Logging in...' : 'Creating account...'}
        {:else}
          {mode === 'login' ? 'Login' : 'Create Account'}
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: var(--spacing-6);
  }

  .login-box {
    background: var(--color-surface);
    padding: var(--spacing-10);
    border-radius: var(--radius-2xl);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 440px;
    border: 1px solid var(--color-border-light);
  }

  h1 {
    text-align: center;
    margin: 0 0 var(--spacing-6);
    font-size: var(--text-3xl);
    font-weight: var(--font-extrabold);
    color: var(--color-text);
    letter-spacing: -0.025em;
  }

  .mode-tabs {
    display: flex;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-6);
    background: var(--color-bg);
    padding: var(--spacing-1);
    border-radius: var(--radius-lg);
  }

  .mode-tab {
    flex: 1;
    padding: var(--spacing-3);
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-normal);
  }

  .mode-tab:hover:not(.active) {
    color: var(--color-text);
    background: var(--color-surface);
  }

  .mode-tab.active {
    background: var(--color-surface);
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  .error {
    background: #fef2f2;
    color: var(--color-error);
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
    text-align: center;
    font-weight: var(--font-medium);
    border: 1px solid #fecaca;
    font-size: var(--text-sm);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-5);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  label {
    font-weight: var(--font-semibold);
    color: var(--color-text);
    font-size: var(--text-sm);
  }

  .optional {
    font-weight: var(--font-normal);
    color: var(--color-text-light);
  }

  .hint {
    font-size: var(--text-xs);
    color: var(--color-text-light);
  }

  input {
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    background: var(--color-surface);
    transition: var(--transition-normal);
    color: var(--color-text);
    font-weight: var(--font-normal);
  }

  input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
  }

  button[type='submit'] {
    padding: var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-lg);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    cursor: pointer;
    margin-top: var(--spacing-2);
    transition: var(--transition-normal);
    box-shadow: var(--shadow-sm);
  }

  button[type='submit']:hover:not(:disabled) {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  button[type='submit']:disabled {
    background: var(--color-border);
    border-color: var(--color-border);
    color: var(--color-text-light);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
</style>
