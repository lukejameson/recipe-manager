<script lang="ts">
  import { apiClient } from '$lib/api/client';

  type StorageProvider = 'local' | 'r2' | 's3';

  let loading = $state(true);
  let saving = $state(false);
  let testing = $state(false);
  let error = $state('');
  let success = $state('');
  let testResult = $state<{ valid: boolean; error?: string } | null>(null);

  let currentProvider = $state<StorageProvider | null>(null);
  let isLocalEnabled = $state(false);
  let selectedProvider = $state<StorageProvider>('r2');
  let cdnUrl = $state('');
  let maxUploadSizeMb = $state(10);

  let r2AccountId = $state('');
  let r2AccessKeyId = $state('');
  let r2SecretAccessKey = $state('');
  let r2Bucket = $state('');

  let s3Region = $state('');
  let s3AccessKeyId = $state('');
  let s3SecretAccessKey = $state('');
  let s3Bucket = $state('');
  let s3Endpoint = $state('');

  async function loadConfig() {
    loading = true;
    error = '';
    try {
      const config = await apiClient.getStorageConfig();
      if (config) {
        currentProvider = config.provider;
        cdnUrl = config.cdnUrl || '';
        maxUploadSizeMb = config.maxUploadSizeMb || 10;
        isLocalEnabled = config.isLocalEnabled || false;

        if (config.provider === 'r2') {
          selectedProvider = 'r2';
          r2AccountId = (config.config as any)?.accountId || '';
          r2AccessKeyId = (config.config as any)?.accessKeyId || '';
          r2SecretAccessKey = (config.config as any)?.secretAccessKey || '';
          r2Bucket = (config.config as any)?.bucket || '';
        } else if (config.provider === 's3') {
          selectedProvider = 's3';
          s3Region = (config.config as any)?.region || '';
          s3AccessKeyId = (config.config as any)?.accessKeyId || '';
          s3Bucket = (config.config as any)?.bucket || '';
          s3Endpoint = (config.config as any)?.endpoint || '';
        } else if (config.provider === 'local') {
          selectedProvider = 'local';
        }
      }
    } catch (err: any) {
      error = err.message || 'Failed to load storage config';
    } finally {
      loading = false;
    }
  }

  async function handleSave() {
    saving = true;
    error = '';
    success = '';
    testResult = null;
    try {
      let config: Record<string, string> = {};
      if (selectedProvider === 'r2') {
        config = {
          accountId: r2AccountId,
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
          bucket: r2Bucket
        };
      } else if (selectedProvider === 's3') {
        config = {
          region: s3Region,
          accessKeyId: s3AccessKeyId,
          secretAccessKey: s3SecretAccessKey,
          bucket: s3Bucket
        };
        if (s3Endpoint) {
          config.endpoint = s3Endpoint;
        }
      } else {
        config = { path: '/data/photos' };
      }
      await apiClient.updateStorageConfig({
        provider: selectedProvider,
        config,
        cdnUrl: cdnUrl || undefined,
        maxUploadSizeMb
      });
      currentProvider = selectedProvider;
      success = 'Storage configuration saved!';
      setTimeout(() => { success = ''; }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to save storage config';
    } finally {
      saving = false;
    }
  }

  async function handleTest() {
    testing = true;
    error = '';
    testResult = null;
    try {
      let config: Record<string, string> = {};
      if (selectedProvider === 'r2') {
        config = {
          accountId: r2AccountId,
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
          bucket: r2Bucket
        };
      } else if (selectedProvider === 's3') {
        config = {
          region: s3Region,
          accessKeyId: s3AccessKeyId,
          secretAccessKey: s3SecretAccessKey,
          bucket: s3Bucket
        };
        if (s3Endpoint) {
          config.endpoint = s3Endpoint;
        }
      }
      await apiClient.updateStorageConfig({
        provider: selectedProvider,
        config,
        cdnUrl: cdnUrl || undefined,
        maxUploadSizeMb
      });

      testResult = { valid: true };
    } catch (err: any) {
      testResult = { valid: false, error: err.message || 'Connection failed' };
    } finally {
      testing = false;
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete the storage configuration? Existing photos will not be deleted.')) {
      return;
    }

    saving = true;
    error = '';

    try {
      await apiClient.deleteStorageConfig();
      currentProvider = null;
      selectedProvider = 'r2';
      r2AccountId = '';
      r2AccessKeyId = '';
      r2SecretAccessKey = '';
      r2Bucket = '';
      s3Region = '';
      s3AccessKeyId = '';
      s3SecretAccessKey = '';
      s3Bucket = '';
      s3Endpoint = '';
      cdnUrl = '';
      maxUploadSizeMb = 10;
      success = 'Storage configuration deleted.';
      setTimeout(() => { success = ''; }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to delete storage config';
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    loadConfig();
  });
</script>

<div class="storage-settings">
  {#if loading}
    <div class="loading">Loading storage configuration...</div>
  {:else}
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    {#if success}
      <div class="success-message">{success}</div>
    {/if}

    {#if isLocalEnabled}
      <div class="info-message">
        <strong>Local Storage Mode</strong>
        <p>Local storage is enabled via environment variable <code>LOCAL_PHOTO_STORAGE=true</code>.</p>
        <p>Storage path: <code>/data/photos</code></p>
        <p>To change this configuration, update your environment variables and restart the application.</p>
      </div>
    {:else}
      <div class="form-group">
        <label for="provider">Storage Provider</label>
        <select id="provider" bind:value={selectedProvider}>
          <option value="r2">Cloudflare R2</option>
          <option value="s3">Amazon S3</option>
        </select>
        <p class="hint">Choose where to store uploaded photos.</p>
      </div>

      {#if selectedProvider === 'r2'}
        <div class="provider-fields">
          <h3>R2 Configuration</h3>
          <div class="form-group">
            <label for="r2AccountId">Account ID</label>
            <input
              id="r2AccountId"
              type="text"
              bind:value={r2AccountId}
              placeholder="0c5fca4d0370bfc587abd5524d659dd8"
            />
            <p class="hint">Found in your dashboard URL: dash.cloudflare.com/.../[account-id]/r2</p>
          </div>
          <div class="form-group">
            <label for="r2AccessKeyId">Access Key ID</label>
            <input
              id="r2AccessKeyId"
              type="text"
              bind:value={r2AccessKeyId}
              placeholder="Access Key ID"
            />
            <p class="hint">R2 → Account Details → Manage API Tokens → Create token → shown after creation</p>
          </div>
          <div class="form-group">
            <label for="r2SecretAccessKey">Secret Access Key</label>
            <input
              id="r2SecretAccessKey"
              type="password"
              bind:value={r2SecretAccessKey}
              placeholder="Secret Access Key"
            />
            <p class="hint">Shown only once when creating the API token — copy it immediately</p>
          </div>
          <div class="form-group">
            <label for="r2Bucket">Bucket Name</label>
            <input
              id="r2Bucket"
              type="text"
              bind:value={r2Bucket}
              placeholder="my-recipe-photos"
            />
          </div>
        </div>
      {/if}

      {#if selectedProvider === 's3'}
        <div class="provider-fields">
          <h3>S3 Configuration</h3>
          <div class="form-group">
            <label for="s3Region">Region</label>
            <input
              id="s3Region"
              type="text"
              bind:value={s3Region}
              placeholder="us-east-1"
            />
          </div>
          <div class="form-group">
            <label for="s3AccessKeyId">Access Key ID</label>
            <input
              id="s3AccessKeyId"
              type="text"
              bind:value={s3AccessKeyId}
              placeholder="Access Key ID"
            />
          </div>
          <div class="form-group">
            <label for="s3SecretAccessKey">Secret Access Key</label>
            <input
              id="s3SecretAccessKey"
              type="password"
              bind:value={s3SecretAccessKey}
              placeholder="Secret Access Key"
            />
          </div>
          <div class="form-group">
            <label for="s3Bucket">Bucket Name</label>
            <input
              id="s3Bucket"
              type="text"
              bind:value={s3Bucket}
              placeholder="my-recipe-photos"
            />
          </div>
          <div class="form-group">
            <label for="s3Endpoint">Endpoint (optional)</label>
            <input
              id="s3Endpoint"
              type="text"
              bind:value={s3Endpoint}
              placeholder="https://s3.amazonaws.com"
            />
            <p class="hint">Leave empty for AWS S3. Use for MinIO, Backblaze B2, etc.</p>
          </div>
        </div>
      {/if}

      <div class="form-group">
        <label for="cdnUrl">CDN URL (optional)</label>
        <input
          id="cdnUrl"
          type="url"
          bind:value={cdnUrl}
          placeholder="https://cdn.example.com"
        />
        <p class="hint">Optional custom domain or CDN to serve photos faster.</p>
      </div>

      <div class="form-group">
        <label for="maxUploadSize">Max Upload Size (MB)</label>
        <input
          id="maxUploadSize"
          type="number"
          min="1"
          max="100"
          bind:value={maxUploadSizeMb}
        />
      </div>

      {#if testResult}
        <div class="test-result" class:valid={testResult.valid} class:invalid={!testResult.valid}>
          {#if testResult.valid}
            Connection successful!
          {:else}
            {testResult.error || 'Connection failed'}
          {/if}
        </div>
      {/if}

      <div class="form-actions">
        <button
          class="btn-secondary"
          onclick={handleTest}
          disabled={testing || saving}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          class="btn-primary"
          onclick={handleSave}
          disabled={saving || testing}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
        {#if currentProvider}
          <button
            class="btn-text-danger"
            onclick={handleDelete}
            disabled={saving || testing}
          >
            Delete
          </button>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .storage-settings {
    max-width: 600px;
  }

  .loading {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-muted);
  }

  .error-message {
    background: var(--color-error-bg, #fee2e2);
    color: var(--color-error, #dc2626);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .success-message {
    background: var(--color-success-bg, #dcfce7);
    color: var(--color-success, #16a34a);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .info-message {
    background: var(--color-info-bg, #dbeafe);
    color: var(--color-info, #2563eb);
    padding: 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .info-message p {
    margin: 0.5rem 0 0 0;
    font-size: 0.875rem;
  }

  .info-message code {
    background: rgba(0,0,0,0.1);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.375rem;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-top: 0.25rem;
  }

  .provider-fields {
    background: var(--color-bg-subtle);
    padding: 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .provider-fields h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .test-result {
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .test-result.valid {
    background: var(--color-success-bg, #dcfce7);
    color: var(--color-success, #16a34a);
  }

  .test-result.invalid {
    background: var(--color-error-bg, #fee2e2);
    color: var(--color-error, #dc2626);
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    color: var(--color-text);
    border: 1px solid var(--color-border);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-bg-subtle);
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-text-danger {
    background: none;
    border: none;
    color: var(--color-error);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-text-danger:hover:not(:disabled) {
    text-decoration: underline;
  }

  .btn-text-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
