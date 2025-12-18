<script lang="ts">
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';

  let username = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit() {
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
</script>

<div class="login-container">
  <div class="login-box">
    <h1>🍳 Recipe Manager</h1>
    <h2>Login</h2>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div class="form-group">
        <label for="username">Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          required
          placeholder="Enter username"
          autocomplete="username"
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          placeholder="Enter password"
          autocomplete="current-password"
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
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
    margin: 0 0 var(--spacing-2);
    font-size: var(--text-4xl);
    font-weight: var(--font-extrabold);
    color: var(--color-text);
    letter-spacing: -0.025em;
  }

  h2 {
    text-align: center;
    margin: 0 0 var(--spacing-8);
    color: var(--color-text-secondary);
    font-size: var(--text-xl);
    font-weight: var(--font-medium);
  }

  .error {
    background: #fef2f2;
    color: var(--color-error);
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
    text-align: center;
    font-weight: var(--font-medium);
    border-left: 3px solid var(--color-error);
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
