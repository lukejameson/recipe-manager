<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import Header from '$lib/components/Header.svelte';

  type Session = {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: Date;
    lastActiveAt: Date;
    expiresAt: Date;
    isCurrent: boolean;
  };

  // Profile state
  let email = $state(authStore.user?.email ?? '');
  let displayName = $state(authStore.user?.displayName ?? '');
  let profileSaving = $state(false);
  let profileSuccess = $state('');
  let profileError = $state('');

  // Password state
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let passwordSaving = $state(false);
  let passwordSuccess = $state('');
  let passwordError = $state('');

  // Sessions state
  let sessions = $state<Session[]>([]);
  let sessionsLoading = $state(true);
  let sessionsError = $state('');

  // Delete account state
  let deletePassword = $state('');
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);
  let deleteError = $state('');

  onMount(async () => {
    if (!authStore.isAuthenticated) {
      goto('/login');
      return;
    }
    await loadSessions();
  });

  async function loadSessions() {
    sessionsLoading = true;
    sessionsError = '';
    try {
      sessions = await trpc.auth.listSessions.query();
    } catch (err: any) {
      sessionsError = err.message || 'Failed to load sessions';
    } finally {
      sessionsLoading = false;
    }
  }

  async function handleUpdateProfile() {
    profileSaving = true;
    profileError = '';
    profileSuccess = '';

    try {
      await trpc.auth.updateProfile.mutate({
        email: email || null,
        displayName: displayName || null,
      });
      profileSuccess = 'Profile updated successfully';
      setTimeout(() => (profileSuccess = ''), 3000);
    } catch (err: any) {
      profileError = err.message || 'Failed to update profile';
    } finally {
      profileSaving = false;
    }
  }

  async function handleChangePassword() {
    passwordError = '';
    passwordSuccess = '';

    if (newPassword !== confirmPassword) {
      passwordError = 'Passwords do not match';
      return;
    }

    if (newPassword.length < 8) {
      passwordError = 'Password must be at least 8 characters';
      return;
    }

    passwordSaving = true;

    try {
      await trpc.auth.changePassword.mutate({
        currentPassword,
        newPassword,
      });
      passwordSuccess = 'Password changed successfully';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      setTimeout(() => (passwordSuccess = ''), 3000);
    } catch (err: any) {
      passwordError = err.message || 'Failed to change password';
    } finally {
      passwordSaving = false;
    }
  }

  async function handleRevokeSession(sessionId: string) {
    try {
      await trpc.auth.revokeSession.mutate({ sessionId });
      sessions = sessions.filter((s) => s.id !== sessionId);
    } catch (err: any) {
      sessionsError = err.message || 'Failed to revoke session';
    }
  }

  async function handleRevokeAllOther() {
    if (!confirm('Are you sure you want to log out all other sessions?')) {
      return;
    }

    try {
      await trpc.auth.revokeAllOtherSessions.mutate();
      sessions = sessions.filter((s) => s.isCurrent);
    } catch (err: any) {
      sessionsError = err.message || 'Failed to revoke sessions';
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      deleteError = 'Please enter your password';
      return;
    }

    deleting = true;
    deleteError = '';

    try {
      await trpc.auth.deleteAccount.mutate({ password: deletePassword });
      authStore.logout();
      goto('/login');
    } catch (err: any) {
      deleteError = err.message || 'Failed to delete account';
      deleting = false;
    }
  }

  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function parseUserAgent(ua: string | null): string {
    if (!ua) return 'Unknown device';

    // Simple parsing - extract browser and OS
    let browser = 'Unknown browser';
    let os = 'Unknown OS';

    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return `${browser} on ${os}`;
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="header-row">
      <h1>Profile</h1>
    </div>

    <!-- Profile Section -->
    <section class="section">
      <h2>Profile Information</h2>
      <p class="section-description">Update your profile details.</p>

      {#if profileError}
        <div class="error-message">{profileError}</div>
      {/if}
      {#if profileSuccess}
        <div class="success-message">{profileSuccess}</div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleUpdateProfile(); }} class="form">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            type="text"
            id="username"
            value={authStore.user?.username ?? ''}
            disabled
            class="input disabled"
          />
          <span class="hint">Username cannot be changed</span>
        </div>

        <div class="form-group">
          <label for="displayName">Display Name</label>
          <input
            type="text"
            id="displayName"
            bind:value={displayName}
            placeholder="Your display name"
            class="input"
          />
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            type="email"
            id="email"
            bind:value={email}
            placeholder="your@email.com"
            class="input"
          />
        </div>

        <button type="submit" class="btn-primary" disabled={profileSaving}>
          {profileSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </section>

    <!-- Password Section -->
    <section class="section">
      <h2>Change Password</h2>
      <p class="section-description">Update your password to keep your account secure.</p>

      {#if passwordError}
        <div class="error-message">{passwordError}</div>
      {/if}
      {#if passwordSuccess}
        <div class="success-message">{passwordSuccess}</div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleChangePassword(); }} class="form">
        <div class="form-group">
          <label for="currentPassword">Current Password</label>
          <input
            type="password"
            id="currentPassword"
            bind:value={currentPassword}
            required
            class="input"
          />
        </div>

        <div class="form-group">
          <label for="newPassword">New Password</label>
          <input
            type="password"
            id="newPassword"
            bind:value={newPassword}
            required
            minlength="8"
            class="input"
          />
          <span class="hint">Must be at least 8 characters</span>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input
            type="password"
            id="confirmPassword"
            bind:value={confirmPassword}
            required
            class="input"
          />
        </div>

        <button type="submit" class="btn-primary" disabled={passwordSaving}>
          {passwordSaving ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </section>

    <!-- Sessions Section -->
    <section class="section">
      <h2>Active Sessions</h2>
      <p class="section-description">
        Manage your active login sessions. If you see a session you don't recognize, revoke it immediately.
      </p>

      {#if sessionsError}
        <div class="error-message">{sessionsError}</div>
      {/if}

      {#if sessionsLoading}
        <div class="loading">Loading sessions...</div>
      {:else}
        <div class="sessions-list">
          {#each sessions as session (session.id)}
            <div class="session-item" class:current={session.isCurrent}>
              <div class="session-info">
                <div class="session-device">
                  {parseUserAgent(session.userAgent)}
                  {#if session.isCurrent}
                    <span class="current-badge">Current</span>
                  {/if}
                </div>
                <div class="session-details">
                  <span>IP: {session.ipAddress ?? 'Unknown'}</span>
                  <span>Last active: {formatDate(session.lastActiveAt)}</span>
                </div>
              </div>
              {#if !session.isCurrent}
                <button
                  class="btn-small danger"
                  onclick={() => handleRevokeSession(session.id)}
                >
                  Revoke
                </button>
              {/if}
            </div>
          {/each}
        </div>

        {#if sessions.length > 1}
          <button class="btn-secondary mt-4" onclick={handleRevokeAllOther}>
            Log out all other sessions
          </button>
        {/if}
      {/if}
    </section>

    <!-- Delete Account Section -->
    <section class="section danger-zone">
      <h2>Danger Zone</h2>
      <p class="section-description">
        Permanently delete your account and all associated data. This action cannot be undone.
      </p>

      {#if !showDeleteConfirm}
        <button class="btn-danger" onclick={() => (showDeleteConfirm = true)}>
          Delete Account
        </button>
      {:else}
        <div class="delete-confirm">
          {#if deleteError}
            <div class="error-message">{deleteError}</div>
          {/if}

          <p class="warning-text">
            This will permanently delete your account and all your recipes, collections, tags, and other data.
            This cannot be undone.
          </p>

          <div class="form-group">
            <label for="deletePassword">Enter your password to confirm</label>
            <input
              type="password"
              id="deletePassword"
              bind:value={deletePassword}
              class="input"
              placeholder="Your password"
            />
          </div>

          <div class="button-row">
            <button class="btn-secondary" onclick={() => (showDeleteConfirm = false)} disabled={deleting}>
              Cancel
            </button>
            <button class="btn-danger" onclick={handleDeleteAccount} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Permanently Delete Account'}
            </button>
          </div>
        </div>
      {/if}
    </section>
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: 2rem 0;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .header-row {
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 2rem;
    margin: 0;
    color: var(--color-text);
  }

  h2 {
    font-size: 1.25rem;
    margin: 0 0 0.5rem;
    color: var(--color-text);
  }

  .section {
    background: white;
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: 1.5rem;
  }

  .section-description {
    color: var(--color-text-light);
    margin: 0 0 1.5rem;
    line-height: 1.5;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.875rem;
  }

  .input {
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.2s;
  }

  .input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .input.disabled {
    background: var(--color-bg-subtle);
    color: var(--color-text-light);
    cursor: not-allowed;
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-text-light);
  }

  .error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .success-message {
    background: #dcfce7;
    color: #166534;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-light);
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    align-self: flex-start;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: white;
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--color-primary);
  }

  .btn-secondary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-small {
    padding: 0.375rem 0.75rem;
    background: white;
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-small.danger {
    color: #dc2626;
    border-color: #fca5a5;
  }

  .btn-small.danger:hover {
    background: #fef2f2;
  }

  .btn-danger {
    padding: 0.75rem 1.5rem;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-danger:hover:not(:disabled) {
    background: #b91c1c;
  }

  .btn-danger:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* Sessions */
  .sessions-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .session-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .session-item.current {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .session-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .session-device {
    font-weight: 600;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .current-badge {
    background: var(--color-primary);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .session-details {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--color-text-light);
  }

  .mt-4 {
    margin-top: 1rem;
  }

  /* Danger Zone */
  .danger-zone {
    border: 2px solid #fca5a5;
  }

  .danger-zone h2 {
    color: #dc2626;
  }

  .delete-confirm {
    padding: 1rem;
    background: #fef2f2;
    border-radius: var(--radius-md);
  }

  .warning-text {
    color: #dc2626;
    margin: 0 0 1rem;
    font-weight: 500;
  }

  .button-row {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  @media (max-width: 640px) {
    .session-details {
      flex-direction: column;
      gap: 0.25rem;
    }

    .button-row {
      flex-direction: column;
    }

    .btn-primary,
    .btn-secondary,
    .btn-danger {
      width: 100%;
    }
  }
</style>
