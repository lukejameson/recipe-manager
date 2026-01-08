<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import { authStore, type UserFeatureFlags } from '$lib/stores/auth.svelte';
  import Header from '$lib/components/Header.svelte';

  type User = {
    id: string;
    username: string;
    email: string | null;
    displayName: string | null;
    isAdmin: boolean;
    featureFlags: UserFeatureFlags;
    createdAt: Date;
    lastLoginAt: Date | null;
  };

  let loading = $state(true);
  let error = $state('');
  let success = $state('');
  let users = $state<User[]>([]);
  let selectedUser = $state<User | null>(null);
  let saving = $state(false);

  // Feature flag labels (user-friendly names)
  const featureLabels: Record<keyof UserFeatureFlags, string> = {
    aiChat: 'Recipe Ideas & Chat',
    recipeGeneration: 'Create Recipes',
    tagSuggestions: 'Tag Suggestions',
    nutritionCalc: 'Nutrition Info',
    photoExtraction: 'Import from Photos',
    urlImport: 'Import from Websites',
    imageSearch: 'Find Recipe Images',
    jsonldImport: 'Advanced Import (JSONLD)',
  };

  onMount(async () => {
    // Redirect non-admins to home
    if (!authStore.isAdmin) {
      goto('/');
      return;
    }

    await loadUsers();
  });

  async function loadUsers() {
    loading = true;
    error = '';

    try {
      users = await trpc.admin.listUsers.query();
    } catch (err: any) {
      error = err.message || 'Failed to load users';
    } finally {
      loading = false;
    }
  }

  function selectUser(user: User) {
    selectedUser = { ...user, featureFlags: { ...user.featureFlags } };
  }

  function closeModal() {
    selectedUser = null;
  }

  async function handleSaveFeatures() {
    if (!selectedUser) return;

    saving = true;
    error = '';

    try {
      await trpc.admin.updateUserFeatures.mutate({
        userId: selectedUser.id,
        featureFlags: selectedUser.featureFlags,
      });

      // Update local state
      users = users.map((u) =>
        u.id === selectedUser!.id ? { ...u, featureFlags: selectedUser!.featureFlags } : u
      );

      success = `Features updated for ${selectedUser.username}`;
      setTimeout(() => {
        success = '';
      }, 3000);
      closeModal();
    } catch (err: any) {
      error = err.message || 'Failed to update features';
    } finally {
      saving = false;
    }
  }

  async function handleToggleAdmin(user: User) {
    if (user.id === authStore.user?.id) {
      error = 'Cannot change your own admin status';
      return;
    }

    const action = user.isAdmin ? 'demote' : 'promote';
    if (!confirm(`Are you sure you want to ${action} ${user.username} ${user.isAdmin ? 'from' : 'to'} admin?`)) {
      return;
    }

    error = '';

    try {
      await trpc.admin.toggleAdmin.mutate({
        userId: user.id,
        isAdmin: !user.isAdmin,
      });

      users = users.map((u) => (u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u));
      success = `${user.username} ${user.isAdmin ? 'demoted' : 'promoted'}`;
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to toggle admin';
    }
  }

  async function handleDeleteUser(user: User) {
    if (user.id === authStore.user?.id) {
      error = 'Cannot delete your own account';
      return;
    }

    if (!confirm(`Are you sure you want to delete ${user.username}? This will delete all their recipes and data.`)) {
      return;
    }

    error = '';

    try {
      await trpc.admin.deleteUser.mutate({ userId: user.id });
      users = users.filter((u) => u.id !== user.id);
      success = `${user.username} deleted`;
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to delete user';
    }
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
</script>

<Header />

{#if authStore.isAdmin}
  <main>
    <div class="container">
      <div class="header-row">
        <h1>User Management</h1>
        <a href="/admin" class="btn-secondary">Back to Admin</a>
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      {#if success}
        <div class="success-message">{success}</div>
      {/if}

      {#if loading}
        <div class="loading">Loading users...</div>
      {:else}
        <div class="users-table-wrapper">
          <table class="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each users as user (user.id)}
                <tr class:current-user={user.id === authStore.user?.id}>
                  <td class="username-cell">
                    <strong>{user.username}</strong>
                    {#if user.displayName}
                      <span class="display-name">{user.displayName}</span>
                    {/if}
                    {#if user.id === authStore.user?.id}
                      <span class="badge current">You</span>
                    {/if}
                  </td>
                  <td>{user.email || '-'}</td>
                  <td>
                    <span class="badge" class:admin={user.isAdmin}>
                      {user.isAdmin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.lastLoginAt)}</td>
                  <td class="actions-cell">
                    <button class="btn-small" onclick={() => selectUser(user)}>
                      Features
                    </button>
                    {#if user.id !== authStore.user?.id}
                      <button
                        class="btn-small"
                        class:promote={!user.isAdmin}
                        class:demote={user.isAdmin}
                        onclick={() => handleToggleAdmin(user)}
                      >
                        {user.isAdmin ? 'Demote' : 'Promote'}
                      </button>
                      <button class="btn-small danger" onclick={() => handleDeleteUser(user)}>
                        Delete
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </main>

  {#if selectedUser}
    <div class="modal-overlay" onclick={closeModal}>
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Feature Access: {selectedUser.username}</h2>
          <button class="btn-close" onclick={closeModal}>&times;</button>
        </div>

        <div class="modal-body">
          <p class="modal-description">
            Toggle which AI features this user can access. Disabled features will not be available to the user.
          </p>

          <div class="features-list">
            {#each Object.entries(featureLabels) as [key, label]}
              <label class="feature-toggle">
                <input
                  type="checkbox"
                  bind:checked={selectedUser.featureFlags[key as keyof UserFeatureFlags]}
                />
                <span class="feature-label">{label}</span>
              </label>
            {/each}
          </div>

          <div class="feature-actions">
            <button
              class="btn-text"
              onclick={() => {
                if (selectedUser) {
                  selectedUser.featureFlags = {
                    aiChat: true,
                    recipeGeneration: true,
                    tagSuggestions: true,
                    nutritionCalc: true,
                    photoExtraction: true,
                    urlImport: true,
                    imageSearch: true,
                    jsonldImport: true,
                  };
                }
              }}
            >
              Enable All
            </button>
            <button
              class="btn-text"
              onclick={() => {
                if (selectedUser) {
                  selectedUser.featureFlags = {
                    aiChat: false,
                    recipeGeneration: false,
                    tagSuggestions: false,
                    nutritionCalc: false,
                    photoExtraction: false,
                    urlImport: false,
                    imageSearch: false,
                    jsonldImport: false,
                  };
                }
              }}
            >
              Disable All
            </button>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" onclick={closeModal}>Cancel</button>
          <button class="btn-primary" onclick={handleSaveFeatures} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  main {
    flex: 1;
    padding: 2rem 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  h1 {
    font-size: 2rem;
    margin: 0;
    color: var(--color-text);
  }

  .loading {
    text-align: center;
    padding: 3rem;
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

  .users-table-wrapper {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow-x: auto;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
  }

  .users-table th,
  .users-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .users-table th {
    background: var(--color-bg-subtle);
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
  }

  .users-table tr:last-child td {
    border-bottom: none;
  }

  .users-table tr:hover {
    background: var(--color-bg-subtle);
  }

  .users-table tr.current-user {
    background: rgba(255, 107, 53, 0.05);
  }

  .username-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .display-name {
    font-size: 0.875rem;
    color: var(--color-text-light);
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--color-bg-subtle);
    color: var(--color-text-light);
  }

  .badge.admin {
    background: var(--color-primary-light);
    color: var(--color-primary);
  }

  .badge.current {
    background: #e0f2fe;
    color: #0369a1;
    margin-left: 0.5rem;
  }

  .actions-cell {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: white;
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: border-color 0.2s;
  }

  .btn-secondary:hover {
    border-color: var(--color-primary);
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

  .btn-small:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-small.promote {
    color: #166534;
    border-color: #86efac;
  }

  .btn-small.promote:hover {
    background: #dcfce7;
  }

  .btn-small.demote {
    color: #ca8a04;
    border-color: #fde047;
  }

  .btn-small.demote:hover {
    background: #fef9c3;
  }

  .btn-small.danger {
    color: #dc2626;
    border-color: #fca5a5;
  }

  .btn-small.danger:hover {
    background: #fef2f2;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 100;
  }

  .modal {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    font-size: 1.25rem;
    margin: 0;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-light);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
  }

  .btn-close:hover {
    color: var(--color-text);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-description {
    color: var(--color-text-light);
    margin: 0 0 1.5rem;
    line-height: 1.5;
  }

  .features-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feature-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.2s;
  }

  .feature-toggle:hover {
    background: var(--color-border-light);
  }

  .feature-toggle input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
    accent-color: var(--color-primary);
  }

  .feature-label {
    font-weight: 500;
  }

  .feature-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    font-weight: 500;
    padding: 0;
  }

  .btn-text:hover {
    text-decoration: underline;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--color-border);
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
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .users-table th:nth-child(4),
    .users-table td:nth-child(4),
    .users-table th:nth-child(5),
    .users-table td:nth-child(5) {
      display: none;
    }

    .actions-cell {
      flex-direction: column;
    }
  }
</style>
