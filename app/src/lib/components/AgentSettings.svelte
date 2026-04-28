<script lang="ts">
	import { apiClient } from '$lib/api/client';

	interface Agent {
		id: string;
		name: string;
		description: string | null;
		systemPrompt: string;
		icon: string;
		modelId: string | null;
		isBuiltIn: boolean;
		userId: string | null;
		createdAt: Date;
		updatedAt: Date;
	}

	interface AvailableModel {
		id: string;
		name: string;
	}

	interface Props {
		isAdmin?: boolean;
	}

	let { isAdmin = false }: Props = $props();

	let agents = $state<Agent[]>([]);
	let availableModels = $state<AvailableModel[]>([]);
	let loading = $state(true);
	let error = $state('');
	let success = $state('');
	let showForm = $state(false);
	let editingAgent = $state<Agent | null>(null);
	let formName = $state('');
	let formDescription = $state('');
	let formSystemPrompt = $state('');
	let formIcon = $state('');
	let formModelId = $state<string>('');
	let saving = $state(false);
	let viewingPrompt = $state<{ name: string; prompt: string } | null>(null);

	const iconOptions = ['🤖', '🍳', '🥘', '🍕', '🍔', '🍜', '🥗', '🍰', '🥮', '🍞', '🧁', '🍩', '🍪'];

	$effect(() => {
		loadData();
	});

	async function loadData() {
		loading = true;
		error = '';
		try {
			const [agentsList, settings] = await Promise.all([
				apiClient.getAgents(),
				apiClient.getSettings(),
			]);
			agents = agentsList;
			availableModels = settings.availableModels || [];
		} catch (err: any) {
			error = err.message || 'Failed to load data';
		} finally {
			loading = false;
		}
	}

	async function loadAgents() {
		try {
			agents = await apiClient.getAgents();
		} catch (err: any) {
			error = err.message || 'Failed to load agents';
		}
	}

	function resetForm() {
		formName = '';
		formDescription = '';
		formSystemPrompt = '';
		formIcon = '🤖';
		formModelId = '';
		editingAgent = null;
	}

	function startCreate() {
		resetForm();
		showForm = true;
	}

	function startEdit(agent: Agent) {
		editingAgent = agent;
		formName = agent.name;
		formDescription = agent.description || '';
		formSystemPrompt = agent.systemPrompt;
		formIcon = agent.icon;
		formModelId = agent.modelId || '';
		showForm = true;
	}

	function cancelForm() {
		showForm = false;
		resetForm();
	}

	async function handleSubmit() {
		if (!formName.trim() || !formSystemPrompt.trim()) {
			error = 'Name and system prompt are required';
			return;
		}
		saving = true;
		error = '';
		try {
			if (editingAgent) {
				await apiClient.updateAgent({
					id: editingAgent.id,
					name: formName.trim(),
					description: formDescription.trim() || undefined,
					systemPrompt: formSystemPrompt.trim(),
					icon: formIcon || '🤖',
					modelId: formModelId || undefined,
				});
				success = 'Agent updated!';
			} else {
				await apiClient.createAgent({
					name: formName.trim(),
					description: formDescription.trim() || undefined,
					systemPrompt: formSystemPrompt.trim(),
					icon: formIcon || '🤖',
					modelId: formModelId || undefined,
				});
				success = 'Agent created!';
			}
			showForm = false;
			resetForm();
			await loadAgents();
			setTimeout(() => {
				success = '';
			}, 3000);
		} catch (err: any) {
			error = err.message || 'Failed to save agent';
		} finally {
			saving = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Are you sure you want to delete this agent?')) return;
		error = '';
		try {
			await apiClient.deleteAgent(id);
			success = 'Agent deleted';
			await loadAgents();
			setTimeout(() => {
				success = '';
			}, 3000);
		} catch (err: any) {
			error = err.message || 'Failed to delete agent';
		}
	}

	function viewPrompt(agent: Agent) {
		viewingPrompt = { name: agent.name, prompt: agent.systemPrompt };
	}

	function formatModelName(modelId: string): string {
		const match = modelId.match(/claude-(\w+)-?([\d.]*)/i);
		if (match) {
			const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
			const version = match[2] ? ` ${match[2].split('-')[0]}` : '';
			return name + version;
		}
		return modelId;
	}

	function canEditAgent(agent: Agent): boolean {
		if (isAdmin) return true;
		return agent.userId !== null && !agent.isBuiltIn;
	}
</script>

<div class="agents-settings">
	<div class="section-header">
		<div>
			<h2>AI Agents</h2>
			<p class="subtitle">Manage specialized AI assistants with custom system prompts</p>
		</div>
		<button class="btn-primary" onclick={startCreate}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Create Agent
		</button>
	</div>

	{#if error}
		<div class="error-message">{error}</div>
	{/if}
	{#if success}
		<div class="success-message">{success}</div>
	{/if}

	{#if loading}
		<div class="loading">Loading agents...</div>
	{:else if agents.length === 0}
		<div class="empty-state">
			<div class="empty-icon">🤖</div>
			<h3>No agents yet</h3>
			<p>Create your first custom AI agent to get started</p>
			<button class="btn-primary" onclick={startCreate}>Create Agent</button>
		</div>
	{:else}
		<div class="agents-grid">
			{#each agents as agent (agent.id)}
				<div class="agent-card" class:built-in={agent.isBuiltIn}>
					<div class="agent-header">
						<span class="agent-icon">{agent.icon}</span>
						<div class="agent-info">
							<h3>{agent.name}</h3>
							<div class="badges">
								{#if agent.isBuiltIn}
									<span class="badge built-in">Built-in</span>
								{:else}
									<span class="badge custom">Custom</span>
								{/if}
								{#if isAdmin && agent.isBuiltIn}
									<span class="badge admin">Admin</span>
								{/if}
							</div>
						</div>
					</div>
					{#if agent.description}
						<p class="agent-description">{agent.description}</p>
					{/if}
					<div class="agent-meta">
						<span
							class="model-badge"
							class:opus={agent.modelId?.includes('opus')}
							class:haiku={agent.modelId?.includes('haiku')}
							title={agent.modelId || 'Uses default model'}
						>
							{agent.modelId ? formatModelName(agent.modelId) : 'Default'}
						</span>
					</div>
					<div class="agent-actions">
						<button class="btn-text" onclick={() => viewPrompt(agent)}>
							View Prompt
						</button>
						{#if canEditAgent(agent)}
							<button class="btn-text" onclick={() => startEdit(agent)}>
								Edit
							</button>
							<button class="btn-text-danger" onclick={() => handleDelete(agent.id)}>
								Delete
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showForm}
	<div class="modal-overlay" onclick={cancelForm} aria-hidden="true">
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="agent-form-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2 id="agent-form-title">{editingAgent ? 'Edit Agent' : 'Create Agent'}</h2>
				<button class="btn-close" onclick={cancelForm} aria-label="Close modal">&times;</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label for="name">Name</label>
					<input
						id="name"
						type="text"
						bind:value={formName}
						placeholder="e.g., Italian Chef, Pastry Expert"
						maxlength="100"
					/>
				</div>
				<div class="form-group">
					<label for="description">Description</label>
					<input
						id="description"
						type="text"
						bind:value={formDescription}
						placeholder="Brief description of what this agent specializes in"
						maxlength="500"
					/>
				</div>
				<div class="form-group">
					<label>Icon</label>
					<div class="icon-selector">
						{#each iconOptions as icon}
							<button
								type="button"
								class="icon-option"
								class:selected={formIcon === icon}
								onclick={() => (formIcon = icon)}
							>
								{icon}
							</button>
						{/each}
					</div>
				</div>
				<div class="form-group">
					<label for="modelId">Model</label>
					<select id="modelId" bind:value={formModelId}>
						<option value="">Default (from settings)</option>
						{#each availableModels as model}
							<option value={model.id}>{model.name}</option>
						{/each}
					</select>
					<p class="hint">Select a specific model or use the default from your AI settings</p>
				</div>
				<div class="form-group">
					<label for="systemPrompt">System Prompt</label>
					<textarea
						id="systemPrompt"
						bind:value={formSystemPrompt}
						placeholder="Instructions that define the agent's personality, expertise, and behavior..."
						rows="12"
					></textarea>
					<p class="hint">
						Include the recipe JSON format instructions for the agent to output recipes correctly.
					</p>
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn-secondary" onclick={cancelForm}>Cancel</button>
				<button
					class="btn-primary"
					onclick={handleSubmit}
					disabled={saving || !formName.trim() || !formSystemPrompt.trim()}
				>
					{saving ? 'Saving...' : editingAgent ? 'Update Agent' : 'Create Agent'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if viewingPrompt}
	<div class="modal-overlay" onclick={() => (viewingPrompt = null)} aria-hidden="true">
		<div class="modal modal-large" role="dialog" aria-modal="true" aria-labelledby="prompt-view-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2 id="prompt-view-title">{viewingPrompt.name} - System Prompt</h2>
				<button class="btn-close" onclick={() => (viewingPrompt = null)} aria-label="Close modal">&times;</button>
			</div>
			<div class="modal-body">
				<pre class="prompt-preview">{viewingPrompt.prompt}</pre>
			</div>
			<div class="modal-footer">
				<button class="btn-secondary" onclick={() => (viewingPrompt = null)}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.agents-settings {
		padding: 1rem 0;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		gap: 1rem;
	}

	.section-header h2 {
		font-size: 1.5rem;
		margin: 0;
		color: var(--color-text);
	}

	.subtitle {
		color: var(--color-text-light);
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
	}

	.section-header .btn-primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}

	.section-header .btn-primary svg {
		width: 18px;
		height: 18px;
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

	.empty-state {
		text-align: center;
		padding: 3rem 2rem;
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		margin: 0 0 0.5rem;
		color: var(--color-text);
	}

	.empty-state p {
		color: var(--color-text-light);
		margin: 0 0 1.5rem;
	}

	.agents-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.agent-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		transition: box-shadow 0.2s;
	}

	.agent-card:hover {
		box-shadow: var(--shadow-md);
	}

	.agent-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.agent-icon {
		font-size: 2rem;
		line-height: 1;
	}

	.agent-info {
		flex: 1;
		min-width: 0;
	}

	.agent-info h3 {
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
		color: var(--color-text);
	}

	.badges {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-full);
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.badge.built-in {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.badge.custom {
		background: #fef3c7;
		color: #b45309;
	}

	.badge.admin {
		background: #fce7f3;
		color: #be185d;
	}

	.agent-description {
		margin: 0 0 0.75rem;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.agent-meta {
		margin-bottom: 0.75rem;
	}

	.model-badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		background: #f3e8ff;
		color: #7c3aed;
		border-radius: var(--radius-full);
		font-size: 0.7rem;
		font-weight: 500;
	}

	.model-badge.haiku {
		background: #ecfdf5;
		color: #059669;
	}

	.model-badge.opus {
		background: #fef3c7;
		color: #d97706;
	}

	.agent-actions {
		display: flex;
		gap: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-border);
	}

	.btn-text {
		background: none;
		border: none;
		color: var(--color-primary);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0;
	}

	.btn-text:hover {
		text-decoration: underline;
	}

	.btn-text-danger {
		background: none;
		border: none;
		color: #dc2626;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0;
	}

	.btn-text-danger:hover {
		text-decoration: underline;
	}

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
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-large {
		max-width: 800px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.2rem;
		color: var(--color-text);
	}

	.btn-close {
		background: none;
		border: none;
		font-size: 1.75rem;
		color: var(--color-text-light);
		cursor: pointer;
		line-height: 1;
		padding: 0;
	}

	.btn-close:hover {
		color: var(--color-text);
	}

	.modal-body {
		padding: 1.25rem 1.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--color-text);
		font-size: 0.9rem;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.65rem;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.95rem;
		font-family: inherit;
		box-sizing: border-box;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 180px;
	}

	.hint {
		font-size: 0.8rem;
		color: var(--color-text-light);
		margin: 0.5rem 0 0;
	}

	.icon-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.icon-option {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
		background: var(--color-background);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: var(--transition-fast);
	}

	.icon-option:hover {
		border-color: var(--color-primary);
	}

	.icon-option.selected {
		border-color: var(--color-primary);
		background: rgba(74, 158, 255, 0.1);
	}

	.prompt-preview {
		background: var(--color-background);
		padding: 1rem;
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 60vh;
		overflow-y: auto;
		margin: 0;
	}

	.btn-primary {
		padding: 0.65rem 1.25rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.95rem;
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
		padding: 0.65rem 1.25rem;
		background: white;
		color: var(--color-text);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		transition: border-color 0.2s;
	}

	.btn-secondary:hover {
		border-color: var(--color-primary);
	}

	@media (max-width: 640px) {
		.section-header {
			flex-direction: column;
			align-items: stretch;
		}

		.section-header .btn-primary {
			justify-content: center;
		}

		.agents-grid {
			grid-template-columns: 1fr;
		}

		.modal {
			max-height: 100vh;
			border-radius: 0;
		}

		.modal-footer {
			flex-direction: column-reverse;
		}

		.modal-footer button {
			width: 100%;
		}
	}
</style>
