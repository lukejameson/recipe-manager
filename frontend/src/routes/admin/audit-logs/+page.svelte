<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import Header from '$lib/components/Header.svelte';

  type AuditLog = {
    id: string;
    userId: string | null;
    username: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    details: Record<string, unknown> | null;
    ipAddress: string | null;
    createdAt: Date;
  };

  let loading = $state(true);
  let error = $state('');
  let logs = $state<AuditLog[]>([]);
  let total = $state(0);
  let actions = $state<string[]>([]);

  // Filters
  let selectedAction = $state<string>('');
  let page = $state(0);
  const limit = 25;

  onMount(async () => {
    if (!authStore.isAdmin) {
      goto('/');
      return;
    }

    await Promise.all([loadLogs(), loadActions()]);
  });

  async function loadActions() {
    try {
      actions = await trpc.admin.getAuditLogActions.query();
    } catch (err) {
      console.error('Failed to load actions:', err);
    }
  }

  async function loadLogs() {
    loading = true;
    error = '';

    try {
      const result = await trpc.admin.listAuditLogs.query({
        limit,
        offset: page * limit,
        action: selectedAction || undefined,
      });
      logs = result.logs;
      total = result.total;
    } catch (err: any) {
      error = err.message || 'Failed to load audit logs';
    } finally {
      loading = false;
    }
  }

  function handleFilterChange() {
    page = 0;
    loadLogs();
  }

  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatAction(action: string): { label: string; color: string } {
    const actionMap: Record<string, { label: string; color: string }> = {
      'user.login': { label: 'User Login', color: 'green' },
      'user.login_failed': { label: 'Login Failed', color: 'red' },
      'user.logout': { label: 'User Logout', color: 'gray' },
      'user.register': { label: 'User Registered', color: 'blue' },
      'user.password_changed': { label: 'Password Changed', color: 'orange' },
      'user.deleted': { label: 'Account Deleted', color: 'red' },
      'admin.user_features_updated': { label: 'Features Updated', color: 'purple' },
      'admin.user_admin_toggled': { label: 'Admin Toggled', color: 'purple' },
      'admin.user_deleted': { label: 'User Deleted', color: 'red' },
      'admin.invite_created': { label: 'Invite Created', color: 'blue' },
      'admin.invite_deleted': { label: 'Invite Deleted', color: 'orange' },
      'admin.settings_updated': { label: 'Settings Updated', color: 'purple' },
    };

    return actionMap[action] || { label: action, color: 'gray' };
  }

  function formatDetails(details: Record<string, unknown> | null): string {
    if (!details) return '-';

    // Format specific details nicely
    const parts: string[] = [];

    if (details.username) parts.push(`User: ${details.username}`);
    if (details.reason) parts.push(`Reason: ${details.reason}`);
    if (details.failedAttempts) parts.push(`Attempts: ${details.failedAttempts}`);
    if (details.accountLocked) parts.push('Account Locked');
    if (details.code) parts.push(`Code: ${details.code}`);
    if (details.wasAdmin !== undefined) parts.push(`Was Admin: ${details.wasAdmin ? 'Yes' : 'No'}`);
    if (details.isAdmin !== undefined) parts.push(`Is Admin: ${details.isAdmin ? 'Yes' : 'No'}`);
    if (details.selfDelete) parts.push('Self-deleted');

    return parts.length > 0 ? parts.join(', ') : JSON.stringify(details);
  }

  let totalPages = $derived(Math.ceil(total / limit));
</script>

<Header />

{#if authStore.isAdmin}
  <main>
    <div class="container">
      <div class="header-row">
        <h1>Audit Logs</h1>
        <a href="/admin" class="btn-secondary">Back to Admin</a>
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="filters">
        <div class="filter-group">
          <label for="actionFilter">Filter by Action</label>
          <select id="actionFilter" bind:value={selectedAction} onchange={handleFilterChange}>
            <option value="">All Actions</option>
            {#each actions as action}
              <option value={action}>{formatAction(action).label}</option>
            {/each}
          </select>
        </div>
      </div>

      {#if loading}
        <div class="loading">Loading audit logs...</div>
      {:else}
        <div class="logs-section">
          <p class="total-count">{total} total entries</p>

          {#if logs.length === 0}
            <p class="empty-state">No audit logs found.</p>
          {:else}
            <div class="logs-table-wrapper">
              <table class="logs-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {#each logs as log (log.id)}
                    <tr>
                      <td class="time-cell">{formatDate(log.createdAt)}</td>
                      <td>{log.username}</td>
                      <td>
                        <span class="action-badge {formatAction(log.action).color}">
                          {formatAction(log.action).label}
                        </span>
                      </td>
                      <td class="details-cell">{formatDetails(log.details)}</td>
                      <td class="ip-cell">{log.ipAddress ?? '-'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            {#if totalPages > 1}
              <div class="pagination">
                <button
                  class="btn-small"
                  onclick={() => { page--; loadLogs(); }}
                  disabled={page === 0}
                >
                  Previous
                </button>
                <span class="page-info">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  class="btn-small"
                  onclick={() => { page++; loadLogs(); }}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </button>
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  </main>
{/if}

<style>
  main {
    flex: 1;
    padding: 2rem 0;
  }

  .container {
    max-width: 1400px;
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

  .filters {
    background: white;
    padding: 1rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: 1.5rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-group label {
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.875rem;
  }

  .filter-group select {
    padding: 0.5rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-family: inherit;
    min-width: 200px;
  }

  .filter-group select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .logs-section {
    background: white;
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .total-count {
    color: var(--color-text-light);
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }

  .empty-state {
    color: var(--color-text-light);
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }

  .logs-table-wrapper {
    overflow-x: auto;
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .logs-table th,
  .logs-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .logs-table th {
    background: var(--color-bg-subtle);
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
  }

  .logs-table tr:last-child td {
    border-bottom: none;
  }

  .logs-table tr:hover {
    background: var(--color-bg-subtle);
  }

  .time-cell {
    white-space: nowrap;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .details-cell {
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ip-cell {
    font-family: monospace;
    font-size: 0.75rem;
  }

  .action-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .action-badge.green {
    background: #dcfce7;
    color: #166534;
  }

  .action-badge.red {
    background: #fef2f2;
    color: #dc2626;
  }

  .action-badge.blue {
    background: #dbeafe;
    color: #1e40af;
  }

  .action-badge.orange {
    background: #ffedd5;
    color: #c2410c;
  }

  .action-badge.purple {
    background: #f5f3ff;
    color: #7c3aed;
  }

  .action-badge.gray {
    background: var(--color-bg-subtle);
    color: var(--color-text-light);
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .page-info {
    color: var(--color-text-light);
    font-size: 0.875rem;
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

  .btn-small:hover:not(:disabled) {
    border-color: var(--color-primary);
  }

  .btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .logs-table th:nth-child(4),
    .logs-table td:nth-child(4),
    .logs-table th:nth-child(5),
    .logs-table td:nth-child(5) {
      display: none;
    }
  }
</style>
