<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { apiClient } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import Header from '$lib/components/Header.svelte';
  import StorageSettings from '$lib/components/StorageSettings.svelte';
  import AgentSettings from '$lib/components/AgentSettings.svelte';
  type Provider = {
    id: string;
    name: string;
    supportsVision: boolean;
    supportsStreaming: boolean;
  };

  type ConfiguredProvider = {
    id: string;
    providerId: string;
    baseUrl: string | null;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    hasApiKey: boolean;
  };

  type Feature = {
    id: string;
    name: string;
    description: string;
    category: string;
    categoryName: string;
    requiresVision: boolean;
    defaultTemperature: number;
    defaultMaxTokens: number;
    config: {
      id: string;
      providerId: string;
      modelId: string;
      temperature: number;
      maxTokens: number;
      enabled: boolean;
      priority: number;
    } | null;
  };

  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let success = $state('');
  let isAdmin = $state(false);

  // Provider state
  let providers: Provider[] = $state([]);
  let configuredProviders: ConfiguredProvider[] = $state([]);
  let unconfiguredProviders: Provider[] = $state([]);
  let showAddProvider = $state(false);
  let selectedProviderId = $state('');
  let providerApiKey = $state('');
  let providerBaseUrl = $state('');
  let testingProvider = $state(false);
  let providerTestResult: { valid: boolean; error?: string } | null = $state(null);
  let availableProviderModels: Array<{ id: string; name: string }> = $state([]);

  // Feature state
  let features: Feature[] = $state([]);
  let editingFeature: Feature | null = $state(null);
  let featureModels: Array<{ id: string; name: string }> = $state([]);
  let loadingFeatureModels = $state(false);

  // Legacy AI settings (for backwards compatibility)
  let hasApiKey = $state(false);
  let selectedModel = $state('claude-sonnet-4-20250514');
  let selectedSecondaryModel = $state('claude-3-haiku-20240307');
  let availableModels = $state<Array<{ id: string; name: string }>>([]);

  // Pexels API settings
  let hasPexelsApiKey = $state(false);
  let pexelsApiKey = $state('');
  let savingPexels = $state(false);
  let pexelsSuccess = $state('');
  let activeTab = $state<'providers' | 'features' | 'storage' | 'imagesearch' | 'agents'>(
    ['providers', 'features', 'storage', 'imagesearch', 'agents'].includes(page.url.searchParams.get('tab') || '') 
      ? page.url.searchParams.get('tab') as 'providers' | 'features' | 'storage' | 'imagesearch' | 'agents'
      : 'providers'
  );
  const providerDisplayNames: Record<string, string> = {
    'anthropic': 'Anthropic (Claude)',
    'openai': 'OpenAI (GPT)',
    'google': 'Google (Gemini)',
    'openrouter': 'OpenRouter',
    'openai-compatible': 'OpenAI-Compatible (Custom)',
  };

  onMount(async () => {
    try {
      const settings = await apiClient.getSettings();
      isAdmin = settings.isAdmin;
      hasApiKey = settings.hasApiKey;
      hasPexelsApiKey = settings.hasPexelsApiKey;
      selectedModel = settings.model;
      selectedSecondaryModel = settings.secondaryModel;
      availableModels = [...settings.availableModels];
      if (isAdmin) {
        await loadProviderData();
      }
    } catch (err: any) {
      error = err.message || 'Failed to load settings';
    } finally {
      loading = false;
    }
  });

  async function loadProviderData() {
    try {
      const [providersData, featuresData] = await Promise.all([
        apiClient.getProviders(),
        apiClient.getFeatureConfigs(),
      ]);
      providers = providersData.providers;
      configuredProviders = providersData.configured;
      unconfiguredProviders = providersData.unconfigured;
      features = featuresData.features;
    } catch (err: any) {
      console.error('Failed to load provider data:', err);
    }
  }

  async function handleTestProvider() {
    if (!selectedProviderId || !providerApiKey.trim()) {
      providerTestResult = { valid: false, error: 'Please select a provider and enter an API key' };
      return;
    }

    testingProvider = true;
    providerTestResult = null;
    availableProviderModels = [];

    try {
      const result = await apiClient.testProvider({
        providerId: selectedProviderId,
        apiKey: providerApiKey.trim(),
        baseUrl: providerBaseUrl.trim() || undefined,
      });

      providerTestResult = { valid: result.success, error: result.error };

      if (result.success && result.models) {
        availableProviderModels = result.models.map(m => ({ id: m.id, name: m.name }));
      }
    } catch (err: any) {
      providerTestResult = { valid: false, error: err.message };
    } finally {
      testingProvider = false;
    }
  }

  async function handleSaveProvider() {
    if (!selectedProviderId || !providerApiKey.trim()) return;

    saving = true;
    error = '';
    success = '';

    try {
      await apiClient.addProvider({
        providerId: selectedProviderId,
        apiKey: providerApiKey.trim(),
        baseUrl: providerBaseUrl.trim() || undefined,
        isEnabled: true,
      });

      success = 'Provider added successfully!';
      showAddProvider = false;
      selectedProviderId = '';
      providerApiKey = '';
      providerBaseUrl = '';
      providerTestResult = null;
      availableProviderModels = [];

      await loadProviderData();

      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to add provider';
    } finally {
      saving = false;
    }
  }

  async function handleDeleteProvider(providerId: string) {
    if (!confirm(`Are you sure you want to remove the ${providerDisplayNames[providerId] || providerId} configuration?`)) {
      return;
    }

    saving = true;
    error = '';

    try {
      await apiClient.deleteProvider(providerId);
      success = 'Provider removed successfully!';
      await loadProviderData();
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to remove provider';
    } finally {
      saving = false;
    }
  }

  async function handleEditFeature(feature: Feature) {
    editingFeature = feature;
    featureModels = [];
    loadingFeatureModels = true;
    try {
      const result = await apiClient.fetchProviderModels(feature.config?.providerId || '', feature.id);
      featureModels = result.models.map(m => ({ id: m.id, name: m.name }));
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      loadingFeatureModels = false;
    }
  }

  async function handleSaveFeatureConfig() {
    if (!editingFeature || !editingFeature.config) return;

    saving = true;
    error = '';
    success = '';

    try {
      await apiClient.updateFeatureConfig({
        featureId: editingFeature.id,
        providerId: editingFeature.config.providerId,
        modelId: editingFeature.config.modelId,
        temperature: editingFeature.config.temperature,
        maxTokens: editingFeature.config.maxTokens,
        isEnabled: editingFeature.config.enabled,
        priority: editingFeature.config.priority,
      });

      success = 'Feature configuration saved!';
      editingFeature = null;
      await loadProviderData();

      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to save feature configuration';
    } finally {
      saving = false;
    }
  }

  async function handleEnableFeature(feature: Feature) {
    if (configuredProviders.length === 0) {
      error = 'Please configure a provider first';
      return;
    }

    const defaultProvider = configuredProviders[0];
    try {
      const modelsResult = await apiClient.fetchProviderModels(defaultProvider.providerId, feature.id);
      const defaultModel = modelsResult.models[0];

      if (!defaultModel) {
        error = 'No models available for the default provider';
        return;
      }

      await apiClient.updateFeatureConfig({
        featureId: feature.id,
        providerId: defaultProvider.providerId,
        modelId: defaultModel.id,
        temperature: feature.defaultTemperature,
        maxTokens: feature.defaultMaxTokens,
        isEnabled: true,
        priority: 0,
      });

      success = 'Feature enabled!';
      await loadProviderData();
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to enable feature';
    }
  }

  async function handleDisableFeature(feature: Feature) {
    if (!feature.config) return;

    try {
      await apiClient.deleteFeatureConfig(feature.id);
      success = 'Feature disabled!';
      await loadProviderData();
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to disable feature';
    }
  }

  async function handleSavePexelsKey() {
    if (!pexelsApiKey.trim()) return;

    savingPexels = true;
    error = '';

    try {
      await apiClient.updateSettings({ pexelsApiKey: pexelsApiKey.trim() });
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
      await apiClient.updateSettings({ pexelsApiKey: '' });
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
  function groupFeaturesByCategory(features: Feature[]): Map<string, Feature[]> {
    const grouped = new Map<string, Feature[]>();
    for (const feature of features) {
      const list = grouped.get(feature.category) || [];
      list.push(feature);
      grouped.set(feature.category, list);
    }
    return grouped;
  }

  function getCategoryOrder(): string[] {
    return ['chat', 'generation', 'enhancement', 'analysis'];
  }

  function getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
      'chat': 'Chat & Conversation',
      'generation': 'Recipe Generation',
      'enhancement': 'Recipe Enhancement',
      'analysis': 'Analysis & Matching',
    };
    return names[category] || category;
  }

  function requiresBaseUrl(providerId: string): boolean {
    return providerId === 'openai-compatible';
  }

  $effect(() => {
    if (selectedProviderId && !requiresBaseUrl(selectedProviderId)) {
      providerBaseUrl = '';
    }
  });
</script>

<Header />

<main>
  <div class="container">
    <h1>Settings</h1>

    {#if loading}
      <div class="loading">Loading settings...</div>
    {:else}
      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      {#if isAdmin}
        <nav class="settings-tabs">
          <button class="tab-button" class:active={activeTab === 'providers'} onclick={() => { activeTab = 'providers'; goto('/settings?tab=providers', { replaceState: true }); }}>AI Providers</button>
          <button class="tab-button" class:active={activeTab === 'features'} onclick={() => { activeTab = 'features'; goto('/settings?tab=features', { replaceState: true }); }}>Features</button>
          <button class="tab-button" class:active={activeTab === 'storage'} onclick={() => { activeTab = 'storage'; goto('/settings?tab=storage', { replaceState: true }); }}>Storage</button>
          <button class="tab-button" class:active={activeTab === 'imagesearch'} onclick={() => { activeTab = 'imagesearch'; goto('/settings?tab=imagesearch', { replaceState: true }); }}>Image Search</button>
          <button class="tab-button" class:active={activeTab === 'agents'} onclick={() => { activeTab = 'agents'; goto('/settings?tab=agents', { replaceState: true }); }}>Agents</button>
        </nav>
        {#if activeTab === 'providers'}
        <section class="settings-section">
          <div class="section-header">
            <div>
              <h2>AI Providers</h2>
              <p class="section-description">
                Configure multiple AI providers (Anthropic, OpenAI, Google, OpenRouter) and assign specific models to each AI feature.
              </p>
            </div>
            {#if !showAddProvider}
              <button class="btn-primary" onclick={() => showAddProvider = true}>
                Add Provider
              </button>
            {/if}
          </div>

          {#if success}
            <div class="success-message">{success}</div>
          {/if}

          {#if showAddProvider}
            <div class="add-provider-form">
              <h3>Add New Provider</h3>

              <div class="form-group">
                <label for="provider">Provider</label>
                <select id="provider" bind:value={selectedProviderId}>
                  <option value="">Select a provider...</option>
                  {#each unconfiguredProviders as provider}
                    <option value={provider.id}>
                      {providerDisplayNames[provider.id] || provider.name}
                      {#if provider.supportsVision}(Vision){/if}
                    </option>
                  {/each}
                </select>
              </div>

              {#if selectedProviderId}
                <div class="form-group">
                  <label for="apiKey">API Key</label>
                  <input
                    id="apiKey"
                    type="password"
                    bind:value={providerApiKey}
                    placeholder="Enter your API key"
                  />
                  <p class="hint">
                    Your API key will be encrypted before storage.
                  </p>
                </div>

                {#if requiresBaseUrl(selectedProviderId)}
                  <div class="form-group">
                    <label for="baseUrl">Base URL</label>
                    <input
                      id="baseUrl"
                      type="url"
                      bind:value={providerBaseUrl}
                      placeholder="https://api.example.com/v1"
                    />
                    <p class="hint">
                      The base URL for your OpenAI-compatible API endpoint.
                    </p>
                  </div>
                {/if}

                <div class="test-section">
                  <button
                    class="btn-secondary"
                    onclick={handleTestProvider}
                    disabled={testingProvider || !providerApiKey.trim()}
                  >
                    {testingProvider ? 'Testing...' : 'Test Connection'}
                  </button>
                  {#if providerTestResult}
                    <span class="test-result" class:valid={providerTestResult.valid} class:invalid={!providerTestResult.valid}>
                      {providerTestResult.valid ? 'Connection successful!' : providerTestResult.error}
                    </span>
                  {/if}
                </div>

                {#if availableProviderModels.length > 0}
                  <div class="models-preview">
                    <h4>Available Models ({availableProviderModels.length})</h4>
                    <ul>
                      {#each availableProviderModels.slice(0, 5) as model}
                        <li>{model.name}</li>
                      {/each}
                      {#if availableProviderModels.length > 5}
                        <li class="more-models">+{availableProviderModels.length - 5} more</li>
                      {/if}
                    </ul>
                  </div>
                {/if}

                <div class="form-actions">
                  <button
                    class="btn-secondary"
                    onclick={() => {
                      showAddProvider = false;
                      selectedProviderId = '';
                      providerApiKey = '';
                      providerBaseUrl = '';
                      providerTestResult = null;
                      availableProviderModels = [];
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    class="btn-primary"
                    onclick={handleSaveProvider}
                    disabled={saving || !providerApiKey.trim() || (requiresBaseUrl(selectedProviderId) && !providerBaseUrl.trim())}
                  >
                    {saving ? 'Saving...' : 'Add Provider'}
                  </button>
                </div>
              {/if}
            </div>
          {/if}

          <div class="providers-list">
            {#if configuredProviders.length === 0}
              <div class="empty-state">
                <p>No AI providers configured yet.</p>
                <p class="hint">Add a provider to enable AI-powered features.</p>
              </div>
            {:else}
              {#each configuredProviders as config}
                {@const provider = providers.find(p => p.id === config.providerId)}
                <div class="provider-card">
                  <div class="provider-info">
                    <div class="provider-header">
                      <h3>{providerDisplayNames[config.providerId] || config.providerId}</h3>
                      <span class="badge" class:enabled={config.isEnabled}>
                        {config.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div class="provider-capabilities">
                      {#if provider?.supportsVision}
                        <span class="capability">Vision</span>
                      {/if}
                      {#if provider?.supportsStreaming}
                        <span class="capability">Streaming</span>
                      {/if}
                      {#if config.baseUrl}
                        <span class="capability">Custom URL</span>
                      {/if}
                    </div>
                  </div>
                  <div class="provider-actions">
                    <button
                      class="btn-text-danger"
                      onclick={() => handleDeleteProvider(config.providerId)}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </section>
        {/if}
        {#if activeTab === 'features'}
        <section class="settings-section">
          <div class="section-header">
            <div>
              <h2>AI Feature Configuration</h2>
              <p class="section-description">
                Configure which AI model to use for each feature. Features requiring vision must use a vision-capable provider.
              </p>
            </div>
          </div>

          {#if configuredProviders.length === 0}
            <div class="empty-state">
              <p>Please configure at least one AI provider first.</p>
            </div>
          {:else}
            {#each getCategoryOrder() as category}
              {@const categoryFeatures = groupFeaturesByCategory(features).get(category) || []}
              {#if categoryFeatures.length > 0}
                <div class="feature-category">
                  <h3>{getCategoryDisplayName(category)}</h3>
                  <div class="features-list">
                    {#each categoryFeatures as feature}
                      <div class="feature-card">
                        <div class="feature-info">
                          <div class="feature-header">
                            <h4>{feature.name}</h4>
                            {#if feature.requiresVision}
                              <span class="badge vision">Vision Required</span>
                            {/if}
                            {#if feature.config}
                              <span class="badge enabled">Enabled</span>
                            {:else}
                              <span class="badge disabled">Not Configured</span>
                            {/if}
                          </div>
                          <p class="feature-description">{feature.description}</p>
                          {#if feature.config}
                            <div class="feature-config-summary">
                              <span class="config-item">
                                {providerDisplayNames[feature.config.providerId] || feature.config.providerId}
                              </span>
                              <span class="config-item">{feature.config.modelId}</span>
                              <span class="config-item">Temp: {feature.config.temperature}</span>
                            </div>
                          {/if}
                        </div>
                        <div class="feature-actions">
                          {#if feature.config}
                            <button
                              class="btn-secondary"
                              onclick={() => handleEditFeature(feature)}
                            >
                              Edit
                            </button>
                            <button
                              class="btn-text-danger"
                              onclick={() => handleDisableFeature(feature)}
                            >
                              Disable
                            </button>
                          {:else}
                            <button
                              class="btn-primary"
                              onclick={() => handleEnableFeature(feature)}
                            >
                              Enable
                            </button>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
        </section>
        {/if}
        {#if activeTab === 'storage'}
        <section class="settings-section">
          <h2>Storage Configuration</h2>
          <p class="section-description">Configure photo storage for this installation.</p>
          <StorageSettings />
        </section>
        {/if}
        {#if activeTab === 'imagesearch'}
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
        {/if}
        {#if activeTab === 'agents'}
        <section class="settings-section">
          <AgentSettings isAdmin={isAdmin} />
        </section>
        {/if}
      {/if}
    {/if}
  </div>
</main>

{#if editingFeature}
  <div class="modal-overlay" onclick={() => editingFeature = null}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>Configure {editingFeature.name}</h3>
        <button class="btn-close" onclick={() => editingFeature = null}>&times;</button>
      </div>

      <div class="modal-body">
        {#if loadingFeatureModels}
          <div class="loading">Loading available models...</div>
        {:else}
          <div class="form-group">
            <label for="featureProvider">Provider</label>
            <select
              id="featureProvider"
              bind:value={editingFeature.config.providerId}
              onchange={async () => {
                loadingFeatureModels = true;
                try {
                  const result = await apiClient.fetchProviderModels(editingFeature.config.providerId, editingFeature.id);
                  featureModels = result.models.map(m => ({ id: m.id, name: m.name }));
                  editingFeature.config.modelId = featureModels[0]?.id || '';
                } catch (err) {
                  console.error('Failed to fetch models:', err);
                } finally {
                  loadingFeatureModels = false;
                }
              }}
            >
              {#each configuredProviders.filter(p => p.isEnabled) as provider}
                {@const providerInfo = providers.find(p => p.id === provider.providerId)}
                {#if !editingFeature.requiresVision || providerInfo?.supportsVision}
                  <option value={provider.providerId}>
                    {providerDisplayNames[provider.providerId] || provider.providerId}
                  </option>
                {/if}
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="featureModel">Model</label>
            <select id="featureModel" bind:value={editingFeature.config.modelId}>
              {#each featureModels as model}
                <option value={model.id}>{model.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="temperature">Temperature ({editingFeature.config.temperature})</label>
              <input
                id="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                bind:value={editingFeature.config.temperature}
              />
              <p class="hint">Lower = more deterministic, Higher = more creative</p>
            </div>

            <div class="form-group">
              <label for="maxTokens">Max Tokens</label>
              <input
                id="maxTokens"
                type="number"
                min="1"
                max="128000"
                bind:value={editingFeature.config.maxTokens}
              />
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={editingFeature.config.enabled} />
              Enabled
            </label>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => editingFeature = null}>
          Cancel
        </button>
        <button
          class="btn-primary"
          onclick={handleSaveFeatureConfig}
          disabled={saving || !editingFeature.config.modelId}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  main {
    flex: 1;
    padding: 2rem 0;
  }

  .container {
    max-width: 1000px;
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
  .settings-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-border);
  }
  .tab-button {
    padding: 0.75rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }
  .tab-button:hover {
    color: var(--color-text);
  }
  .tab-button.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }
  .settings-section {
    background: white;
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: 1.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .section-header h2 {
    font-size: 1.25rem;
    margin: 0 0 0.5rem;
    color: var(--color-text);
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
  .hint-box {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: var(--radius-md);
    padding: 0.875rem 1rem;
    font-size: 0.875rem;
    color: #0369a1;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }
  .hint-box a {
    color: #0284c7;
    font-weight: 500;
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

  .form-actions {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
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

  /* Providers */
  .add-provider-form {
    background: var(--color-bg-subtle);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    margin-bottom: 1.5rem;
  }

  .add-provider-form h3 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
  }

  .test-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1rem 0;
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

  .models-preview {
    background: white;
    padding: 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
  }

  .models-preview h4 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    color: var(--color-text-light);
  }

  .models-preview ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .models-preview li {
    font-size: 0.9rem;
    color: var(--color-text);
  }

  .more-models {
    color: var(--color-text-light);
    font-style: italic;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-light);
  }

  .empty-state p {
    margin: 0 0 0.5rem;
  }

  .providers-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .provider-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .provider-info {
    flex: 1;
  }

  .provider-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .provider-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--color-border);
    color: var(--color-text-light);
  }

  .badge.enabled {
    background: #dcfce7;
    color: #166534;
  }

  .badge.disabled {
    background: #fee2e2;
    color: #991b1b;
  }

  .badge.vision {
    background: #dbeafe;
    color: #1e40af;
  }

  .provider-capabilities {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .capability {
    font-size: 0.8rem;
    color: var(--color-text-light);
    background: white;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
  }

  /* Features */
  .feature-category {
    margin-bottom: 2rem;
  }

  .feature-category:last-child {
    margin-bottom: 0;
  }

  .feature-category h3 {
    font-size: 1rem;
    color: var(--color-text-light);
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .features-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feature-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .feature-info {
    flex: 1;
  }

  .feature-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
  }

  .feature-header h4 {
    margin: 0;
    font-size: 1rem;
  }

  .feature-description {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-light);
  }

  .feature-config-summary {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .config-item {
    font-size: 0.8rem;
    color: var(--color-text);
    background: white;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
  }

  .feature-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow: auto;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-text-light);
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-close:hover {
    color: var(--color-text);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-subtle);
  }

  .form-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    width: 1.25rem;
    height: 1.25rem;
  }
    .section-header {
      flex-direction: column;
      gap: 1rem;
    }

    .provider-card,
    .feature-card {
      flex-direction: column;
      gap: 1rem;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
</style>
