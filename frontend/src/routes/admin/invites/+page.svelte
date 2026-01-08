<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import Header from '$lib/components/Header.svelte';

  type InviteCode = {
    id: string;
    code: string;
    createdBy: string;
    createdByUsername: string;
    usedBy: string | null;
    usedByUsername: string | null;
    usedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    isUsed: boolean;
    isExpired: boolean;
  };

  let loading = $state(true);
  let creating = $state(false);
  let error = $state('');
  let success = $state('');
  let codes = $state<InviteCode[]>([]);
  let expiresInDays = $state<number | undefined>(undefined);
  let copiedCode = $state<string | null>(null);

  onMount(async () => {
    // Redirect non-admins to home
    if (!authStore.isAdmin) {
      goto('/');
      return;
    }

    await loadCodes();
  });

  async function loadCodes() {
    loading = true;
    error = '';

    try {
      codes = await trpc.admin.listInviteCodes.query();
    } catch (err: any) {
      error = err.message || 'Failed to load invite codes';
    } finally {
      loading = false;
    }
  }

  async function handleCreateCode() {
    creating = true;
    error = '';

    try {
      const newCode = await trpc.admin.createInviteCode.mutate(
        expiresInDays ? { expiresInDays } : undefined
      );

      // Reload to get full code info
      await loadCodes();

      success = `Invite code ${newCode.code} created!`;
      copyToClipboard(newCode.code);
      setTimeout(() => {
        success = '';
      }, 5000);
    } catch (err: any) {
      error = err.message || 'Failed to create invite code';
    } finally {
      creating = false;
    }
  }

  async function handleDeleteCode(code: InviteCode) {
    if (code.isUsed) {
      error = 'Cannot delete a used invite code';
      return;
    }

    if (!confirm(`Are you sure you want to delete invite code ${code.code}?`)) {
      return;
    }

    error = '';

    try {
      await trpc.admin.deleteInviteCode.mutate({ codeId: code.id });
      codes = codes.filter((c) => c.id !== code.id);
      success = `Invite code ${code.code} deleted`;
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to delete invite code';
    }
  }

  function copyToClipboard(code: string) {
    navigator.clipboard.writeText(code);
    copiedCode = code;
    setTimeout(() => {
      copiedCode = null;
    }, 2000);
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getCodeStatus(code: InviteCode): { text: string; class: string } {
    if (code.isUsed) {
      return { text: 'Used', class: 'used' };
    }
    if (code.isExpired) {
      return { text: 'Expired', class: 'expired' };
    }
    return { text: 'Available', class: 'available' };
  }
</script>

<Header />

{#if authStore.isAdmin}
  <main>
    <div class="container">
      <div class="header-row">
        <h1>Invite Codes</h1>
        <a href="/admin" class="btn-secondary">Back to Admin</a>
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      {#if success}
        <div class="success-message">{success}</div>
      {/if}

      <section class="create-section">
        <h2>Create New Invite Code</h2>
        <p class="section-description">
          Generate a single-use invite code for a new user to register.
        </p>

        <div class="create-form">
          <div class="form-group">
            <label for="expiresInDays">Expires In (optional)</label>
            <select id="expiresInDays" bind:value={expiresInDays}>
              <option value={undefined}>Never expires</option>
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <button class="btn-primary" onclick={handleCreateCode} disabled={creating}>
            {creating ? 'Creating...' : 'Generate Code'}
          </button>
        </div>
      </section>

      {#if loading}
        <div class="loading">Loading invite codes...</div>
      {:else}
        <section class="codes-section">
          <h2>Existing Codes</h2>

          {#if codes.length === 0}
            <p class="empty-state">No invite codes yet. Create one above to invite users.</p>
          {:else}
            <div class="codes-table-wrapper">
              <table class="codes-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Used By</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each codes as code (code.id)}
                    <tr class:used={code.isUsed} class:expired={code.isExpired}>
                      <td class="code-cell">
                        <span class="code-value">{code.code}</span>
                        {#if !code.isUsed && !code.isExpired}
                          <button
                            class="btn-copy"
                            onclick={() => copyToClipboard(code.code)}
                            title="Copy to clipboard"
                          >
                            {copiedCode === code.code ? 'Copied!' : 'Copy'}
                          </button>
                        {/if}
                      </td>
                      <td>
                        <span class="status-badge {getCodeStatus(code).class}">{getCodeStatus(code).text}</span>
                      </td>
                      <td>{code.createdByUsername}</td>
                      <td>
                        {#if code.usedByUsername}
                          <span class="used-by">{code.usedByUsername}</span>
                          <span class="used-at">{formatDate(code.usedAt)}</span>
                        {:else}
                          -
                        {/if}
                      </td>
                      <td>{code.expiresAt ? formatDate(code.expiresAt) : 'Never'}</td>
                      <td>
                        {#if !code.isUsed}
                          <button class="btn-small danger" onclick={() => handleDeleteCode(code)}>
                            Delete
                          </button>
                        {:else}
                          <span class="no-action">-</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </section>
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

  h2 {
    font-size: 1.25rem;
    margin: 0 0 0.5rem;
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

  .create-section {
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

  .create-form {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    flex-wrap: wrap;
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

  .form-group select {
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: inherit;
    min-width: 200px;
  }

  .form-group select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .codes-section {
    background: white;
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .codes-section h2 {
    margin-bottom: 1rem;
  }

  .empty-state {
    color: var(--color-text-light);
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }

  .codes-table-wrapper {
    overflow-x: auto;
  }

  .codes-table {
    width: 100%;
    border-collapse: collapse;
  }

  .codes-table th,
  .codes-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .codes-table th {
    background: var(--color-bg-subtle);
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
  }

  .codes-table tr:last-child td {
    border-bottom: none;
  }

  .codes-table tr:hover:not(.used):not(.expired) {
    background: var(--color-bg-subtle);
  }

  .codes-table tr.used {
    opacity: 0.6;
  }

  .codes-table tr.expired {
    opacity: 0.5;
  }

  .code-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .code-value {
    font-family: monospace;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .btn-copy {
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-copy:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-badge.available {
    background: #dcfce7;
    color: #166534;
  }

  .status-badge.used {
    background: var(--color-bg-subtle);
    color: var(--color-text-light);
  }

  .status-badge.expired {
    background: #fef2f2;
    color: #dc2626;
  }

  .used-by {
    display: block;
    font-weight: 500;
  }

  .used-at {
    font-size: 0.75rem;
    color: var(--color-text-light);
  }

  .no-action {
    color: var(--color-text-light);
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

  @media (max-width: 768px) {
    .create-form {
      flex-direction: column;
      align-items: stretch;
    }

    .form-group select {
      min-width: unset;
      width: 100%;
    }

    .codes-table th:nth-child(3),
    .codes-table td:nth-child(3),
    .codes-table th:nth-child(5),
    .codes-table td:nth-child(5) {
      display: none;
    }
  }
</style>
