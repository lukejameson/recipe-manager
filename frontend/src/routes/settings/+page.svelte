<script lang="ts">
  import { onMount } from 'svelte';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';

  let loading = $state(true);
  let saving = $state(false);
  let testing = $state(false);
  let fetchingModels = $state(false);
  let error = $state('');
  let success = $state('');

  let hasApiKey = $state(false);
  let apiKey = $state('');
  let selectedModel = $state('claude-sonnet-4-20250514');
  let selectedSecondaryModel = $state('claude-3-haiku-20240307');
  let availableModels = $state<Array<{ id: string; name: string }>>([]);
  let testResult = $state<{ valid: boolean; error?: string } | null>(null);

  // Pexels API settings
  let hasPexelsApiKey = $state(false);
  let pexelsApiKey = $state('');
  let savingPexels = $state(false);
  let pexelsSuccess = $state('');

  // AI Memories
  type Memory = { id: string; content: string; enabled: boolean; createdAt: Date };
  let memories = $state<Memory[]>([]);
  let newMemory = $state('');
  let loadingMemories = $state(false);
  let savingMemory = $state(false);
  let memoriesSuccess = $state('');

  onMount(async () => {
    try {
      const [settings, userMemories] = await Promise.all([
        trpc.settings.get.query(),
        trpc.settings.listMemories.query(),
      ]);
      hasApiKey = settings.hasApiKey;
      hasPexelsApiKey = settings.hasPexelsApiKey;
      selectedModel = settings.model;
      selectedSecondaryModel = settings.secondaryModel;
      availableModels = [...settings.availableModels];
      memories = userMemories;
    } catch (err: any) {
      error = err.message || 'Failed to load settings';
    } finally {
      loading = false;
    }
  });

  async function handleTestApiKey() {
    if (!apiKey.trim()) {
      testResult = { valid: false, error: 'Please enter an API key' };
      return;
    }

    testing = true;
    testResult = null;

    try {
      testResult = await trpc.settings.testApiKey.mutate({ apiKey: apiKey.trim() });

      // If valid, fetch available models with this key
      if (testResult.valid) {
        fetchingModels = true;
        try {
          const result = await trpc.settings.fetchModels.query({ apiKey: apiKey.trim() });
          availableModels = result.models;
          // Select a good default primary model if current selection isn't in the list
          if (!availableModels.some((m) => m.id === selectedModel)) {
            const preferred = availableModels.find(
              (m) => m.id.includes('sonnet-4') || m.id.includes('3-5-sonnet')
            );
            selectedModel = preferred?.id || availableModels[0]?.id || selectedModel;
          }
          // Select a good default secondary model if current selection isn't in the list
          if (!availableModels.some((m) => m.id === selectedSecondaryModel)) {
            const preferred = availableModels.find((m) => m.id.includes('haiku'));
            selectedSecondaryModel = preferred?.id || availableModels[0]?.id || selectedSecondaryModel;
          }
        } catch (err) {
          console.error('Failed to fetch models:', err);
        } finally {
          fetchingModels = false;
        }
      }
    } catch (err: any) {
      testResult = { valid: false, error: err.message };
    } finally {
      testing = false;
    }
  }

  async function handleSave() {
    saving = true;
    error = '';
    success = '';

    try {
      await trpc.settings.update.mutate({
        anthropicApiKey: apiKey.trim() || undefined,
        anthropicModel: selectedModel,
        anthropicSecondaryModel: selectedSecondaryModel,
      });

      if (apiKey.trim()) {
        hasApiKey = true;
        apiKey = ''; // Clear the input after saving
        testResult = null;
      }

      success = 'Settings saved successfully!';
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to save settings';
    } finally {
      saving = false;
    }
  }

  async function handleClearApiKey() {
    if (!confirm('Are you sure you want to remove the API key?')) return;

    saving = true;
    error = '';

    try {
      await trpc.settings.update.mutate({ anthropicApiKey: '' });
      hasApiKey = false;
      success = 'API key removed';
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to remove API key';
    } finally {
      saving = false;
    }
  }

  async function handleSavePexelsKey() {
    if (!pexelsApiKey.trim()) return;

    savingPexels = true;
    error = '';

    try {
      await trpc.settings.update.mutate({ pexelsApiKey: pexelsApiKey.trim() });
      hasPexelsApiKey = true;
      pexelsApiKey = '';
      pexelsSuccess = 'Pexels API key saved!';
      setTimeout(() => {
        pexelsSuccess = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to save Pexels API key';
    } finally {
      savingPexels = false;
    }
  }

  async function handleClearPexelsKey() {
    if (!confirm('Are you sure you want to remove the Pexels API key?')) return;

    savingPexels = true;
    error = '';

    try {
      await trpc.settings.update.mutate({ pexelsApiKey: '' });
      hasPexelsApiKey = false;
      pexelsSuccess = 'Pexels API key removed';
      setTimeout(() => {
        pexelsSuccess = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to remove Pexels API key';
    } finally {
      savingPexels = false;
    }
  }

  async function handleAddMemory() {
    if (!newMemory.trim()) return;

    savingMemory = true;
    error = '';

    try {
      const memory = await trpc.settings.createMemory.mutate({ content: newMemory.trim() });
      memories = [memory, ...memories];
      newMemory = '';
      memoriesSuccess = 'Memory added!';
      setTimeout(() => {
        memoriesSuccess = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to add memory';
    } finally {
      savingMemory = false;
    }
  }

  async function handleToggleMemory(id: string, enabled: boolean) {
    try {
      await trpc.settings.updateMemory.mutate({ id, enabled });
      memories = memories.map((m) => (m.id === id ? { ...m, enabled } : m));
    } catch (err: any) {
      error = err.message || 'Failed to update memory';
    }
  }

  async function handleDeleteMemory(id: string) {
    if (!confirm('Are you sure you want to delete this memory?')) return;

    try {
      await trpc.settings.deleteMemory.mutate({ id });
      memories = memories.filter((m) => m.id !== id);
      memoriesSuccess = 'Memory deleted';
      setTimeout(() => {
        memoriesSuccess = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to delete memory';
    }
  }
</script>

<Header />

<main>
  <div class="container">
    <h1>Settings</h1>

    {#if loading}
      <div class="loading">Loading settings...</div>
    {:else}
      <section class="settings-section">
        <h2>AI Configuration</h2>
        <p class="section-description">
          Configure the Anthropic API to enable AI-powered features like automatic nutrition
          calculation.
        </p>

        {#if error}
          <div class="error-message">{error}</div>
        {/if}

        {#if success}
          <div class="success-message">{success}</div>
        {/if}

        <div class="form-group">
          <label for="apiKey">Anthropic API Key</label>
          {#if hasApiKey}
            <div class="api-key-status">
              <span class="status-badge configured">API Key Configured</span>
              <button onclick={handleClearApiKey} class="btn-text-danger" disabled={saving}>
                Remove
              </button>
            </div>
          {/if}
          <input
            id="apiKey"
            type="password"
            bind:value={apiKey}
            placeholder={hasApiKey ? 'Enter new key to replace...' : 'sk-ant-api03-...'}
            autocomplete="off"
          />
          <p class="hint">
            Get your API key from
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">
              console.anthropic.com
            </a>
          </p>
        </div>

        {#if apiKey.trim()}
          <div class="test-section">
            <button onclick={handleTestApiKey} class="btn-secondary" disabled={testing}>
              {testing ? 'Testing...' : 'Test API Key'}
            </button>
            {#if testResult}
              <span class="test-result" class:valid={testResult.valid} class:invalid={!testResult.valid}>
                {testResult.valid ? 'Valid API key!' : testResult.error}
              </span>
            {/if}
          </div>
        {/if}

        <div class="form-group">
          <label for="model">Primary Model</label>
          <select id="model" bind:value={selectedModel}>
            {#each availableModels as model}
              <option value={model.id}>{model.name}</option>
            {/each}
          </select>
          <p class="hint">
            Used for complex tasks like recipe extraction from photos and creative brainstorming.
          </p>
        </div>

        <div class="form-group">
          <label for="secondaryModel">Secondary Model</label>
          <select id="secondaryModel" bind:value={selectedSecondaryModel}>
            {#each availableModels as model}
              <option value={model.id}>{model.name}</option>
            {/each}
          </select>
          <p class="hint">
            Used for simpler tasks like tag suggestions, nutrition calculation, and recipe Q&A.
            Haiku models are faster and more economical.
          </p>
        </div>

        <div class="form-actions">
          <button onclick={handleSave} class="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>

      <section class="settings-section">
        <h2>Image Search</h2>
        <p class="section-description">
          Configure Pexels API to enable searching for recipe images directly from the recipe form.
        </p>

        {#if pexelsSuccess}
          <div class="success-message">{pexelsSuccess}</div>
        {/if}

        <div class="form-group">
          <label for="pexelsApiKey">Pexels API Key</label>
          {#if hasPexelsApiKey}
            <div class="api-key-status">
              <span class="status-badge configured">API Key Configured</span>
              <button onclick={handleClearPexelsKey} class="btn-text-danger" disabled={savingPexels}>
                Remove
              </button>
            </div>
          {/if}
          <input
            id="pexelsApiKey"
            type="password"
            bind:value={pexelsApiKey}
            placeholder={hasPexelsApiKey ? 'Enter new key to replace...' : 'Enter your Pexels API key'}
            autocomplete="off"
          />
          <p class="hint">
            Get a free API key from
            <a href="https://www.pexels.com/api/" target="_blank" rel="noopener">
              pexels.com/api
            </a>
          </p>
        </div>

        {#if pexelsApiKey.trim()}
          <div class="form-actions">
            <button onclick={handleSavePexelsKey} class="btn-primary" disabled={savingPexels}>
              {savingPexels ? 'Saving...' : 'Save Pexels API Key'}
            </button>
          </div>
        {/if}
      </section>

      <section class="settings-section">
        <h2>AI Memories</h2>
        <p class="section-description">
          Guide the AI with your preferences and dietary restrictions. These will be included when
          generating or discussing recipes.
        </p>

        {#if memoriesSuccess}
          <div class="success-message">{memoriesSuccess}</div>
        {/if}

        {#if memories.length > 0}
          <div class="memories-list">
            {#each memories as memory (memory.id)}
              <div class="memory-item" class:disabled={!memory.enabled}>
                <label class="memory-toggle">
                  <input
                    type="checkbox"
                    checked={memory.enabled}
                    onchange={() => handleToggleMemory(memory.id, !memory.enabled)}
                  />
                  <span class="memory-content">{memory.content}</span>
                </label>
                <button
                  class="btn-icon-danger"
                  onclick={() => handleDeleteMemory(memory.id)}
                  title="Delete memory"
                >
                  &times;
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-state">No memories yet. Add some preferences to personalize your AI experience.</p>
        {/if}

        <div class="add-memory-form">
          <input
            type="text"
            bind:value={newMemory}
            placeholder="Add a new memory..."
            maxlength="500"
            onkeydown={(e) => e.key === 'Enter' && handleAddMemory()}
          />
          <button class="btn-primary" onclick={handleAddMemory} disabled={savingMemory || !newMemory.trim()}>
            {savingMemory ? 'Adding...' : 'Add'}
          </button>
        </div>

        <p class="hint">
          Examples: "I'm vegetarian", "Allergic to shellfish", "I prefer spicy food", "Cooking for a
          family of 4"
        </p>
      </section>

      <section class="settings-section info-section">
        <h2>About AI Features</h2>
        <p>
          When configured, AI features will use your Anthropic API key to process requests. Current
          AI-powered features include:
        </p>
        <ul>
          <li>
            <strong>Nutrition Calculator</strong> - Automatically estimate nutritional information
            from recipe ingredients
          </li>
        </ul>
        <p class="note">
          Your API key is encrypted and stored securely on the server. API usage is billed directly
          to your Anthropic account.
        </p>
      </section>
    {/if}
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

  h1 {
    font-size: 2rem;
    margin: 0 0 2rem;
    color: var(--color-text);
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-light);
  }

  .settings-section {
    background: white;
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: 1.5rem;
  }

  .settings-section h2 {
    font-size: 1.25rem;
    margin: 0 0 0.5rem;
    color: var(--color-text);
  }

  .section-description {
    color: var(--color-text-light);
    margin: 0 0 1.5rem;
    line-height: 1.5;
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

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--color-text);
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .hint {
    font-size: 0.875rem;
    color: var(--color-text-light);
    margin: 0.5rem 0 0;
  }

  .hint a {
    color: var(--color-primary);
  }

  .api-key-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-full);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-badge.configured {
    background: #dcfce7;
    color: #166534;
  }

  .btn-text-danger {
    background: none;
    border: none;
    color: #dc2626;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0;
  }

  .btn-text-danger:hover {
    text-decoration: underline;
  }

  .btn-text-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .test-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .test-result {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .test-result.valid {
    color: #166534;
  }

  .test-result.invalid {
    color: #dc2626;
  }

  .form-actions {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 1rem;
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

  .btn-secondary {
    padding: 0.5rem 1rem;
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

  .info-section {
    background: var(--color-bg-subtle);
  }

  .info-section ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  .info-section li {
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }

  .note {
    font-size: 0.875rem;
    color: var(--color-text-light);
    margin: 1rem 0 0;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.03);
    border-radius: var(--radius-md);
  }

  @media (max-width: 640px) {
    .test-section {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  /* AI Memories styles */
  .memories-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .memory-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    transition: opacity 0.2s;
  }

  .memory-item.disabled {
    opacity: 0.5;
  }

  .memory-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    flex: 1;
  }

  .memory-toggle input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
    accent-color: var(--color-primary);
  }

  .memory-content {
    font-size: 0.95rem;
    color: var(--color-text);
  }

  .btn-icon-danger {
    background: none;
    border: none;
    color: #dc2626;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    transition: background 0.2s;
  }

  .btn-icon-danger:hover {
    background: rgba(220, 38, 38, 0.1);
  }

  .empty-state {
    color: var(--color-text-light);
    font-style: italic;
    margin: 1rem 0 1.5rem;
  }

  .add-memory-form {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .add-memory-form input {
    flex: 1;
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: inherit;
  }

  .add-memory-form input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .add-memory-form .btn-primary {
    padding: 0.75rem 1.25rem;
  }

  @media (max-width: 640px) {
    .add-memory-form {
      flex-direction: column;
    }

    .add-memory-form .btn-primary {
      width: 100%;
    }
  }
</style>
