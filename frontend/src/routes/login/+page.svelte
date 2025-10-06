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
    padding: var(--spacing-lg);
  }

  .login-box {
    background: var(--color-surface);
    padding: var(--spacing-2xl);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    width: 100%;
    max-width: 440px;
    border: 2px solid var(--color-border);
  }

  h1 {
    text-align: center;
    margin: 0 0 var(--spacing-sm);
    font-size: 2.5rem;
    font-weight: 800;
  }

  h2 {
    text-align: center;
    margin: 0 0 var(--spacing-xl);
    color: var(--color-text-light);
    font-size: 1.25rem;
    font-weight: 500;
  }

  .error {
    background: #ffe5e5;
    color: var(--color-error);
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-lg);
    text-align: center;
    font-weight: 500;
    border-left: 4px solid var(--color-error);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  label {
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.9375rem;
  }

  input {
    padding: var(--spacing-md);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    background: var(--color-surface);
    transition: all 0.2s;
  }

  input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
  }

  button[type='submit'] {
    padding: var(--spacing-md);
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 1.0625rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: var(--spacing-sm);
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
  }

  button[type='submit']:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  button[type='submit']:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }

</style>
