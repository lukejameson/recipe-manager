<script lang="ts">
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';

  let username = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let isRegister = $state(false);

  async function handleSubmit() {
    error = '';
    loading = true;

    try {
      let result;
      if (isRegister) {
        result = await trpc.auth.register.mutate({ username, password });
      } else {
        result = await trpc.auth.login.mutate({ username, password });
      }

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
    <h2>{isRegister ? 'Create Account' : 'Login'}</h2>

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
          minlength="3"
          placeholder="Enter username"
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          minlength="8"
          placeholder="Enter password"
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
      </button>
    </form>

    <p class="toggle-text">
      {isRegister ? 'Already have an account?' : "Don't have an account?"}
      <button
        type="button"
        class="toggle-button"
        onclick={() => {
          isRegister = !isRegister;
          error = '';
        }}
      >
        {isRegister ? 'Login' : 'Register'}
      </button>
    </p>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 1rem;
  }

  .login-box {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  h1 {
    text-align: center;
    margin: 0 0 0.5rem;
    color: #333;
    font-size: 2rem;
  }

  h2 {
    text-align: center;
    margin: 0 0 1.5rem;
    color: #666;
    font-size: 1.5rem;
    font-weight: normal;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    text-align: center;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 500;
    color: #333;
  }

  input {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus {
    outline: none;
    border-color: #4a9eff;
  }

  button[type='submit'] {
    padding: 0.75rem;
    background: #4a9eff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    margin-top: 0.5rem;
  }

  button[type='submit']:hover:not(:disabled) {
    background: #3a8eef;
  }

  button[type='submit']:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .toggle-text {
    text-align: center;
    margin-top: 1.5rem;
    color: #666;
  }

  .toggle-button {
    background: none;
    border: none;
    color: #4a9eff;
    cursor: pointer;
    font-size: inherit;
    text-decoration: underline;
    padding: 0;
    margin-left: 0.25rem;
  }

  .toggle-button:hover {
    color: #3a8eef;
  }
</style>
