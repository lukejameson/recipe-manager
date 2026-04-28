<script lang="ts">
	import { apiClient } from '$lib/api/client';
	interface Variable {
		name: string;
		description: string;
		sampleValue: string;
	}
	interface PromptData {
		featureId: string;
		content: string;
		version: number;
		updatedAt: Date | null;
		updatedBy: string | null;
		updatedByUsername: string | null;
		variables: Variable[];
		isDefault: boolean;
	}
	interface HistoryEntry {
		id: string;
		content: string;
		version: number;
		changedBy: string | null;
		changedByUsername: string | null;
		changedAt: Date;
	}
	interface Props {
		prompt: PromptData;
		onClose: () => void;
		onSave: (content: string) => void;
	}
	let { prompt, onClose, onSave }: Props = $props();
	let editingContent = $state(prompt.content);
	let showHistory = $state(false);
	let history: HistoryEntry[] = $state([]);
	let loadingHistory = $state(false);
	let previewContent = $state('');
	let saving = $state(false);
	let error = $state('');
	function getPreviewContent(): string {
		let preview = editingContent;
		for (const v of prompt.variables) {
			const placeholder = `{{${v.name}}}`;
			if (preview.includes(placeholder)) {
				preview = preview.split(placeholder).join(`[${v.name}: ${v.sampleValue}]`);
			}
		}
		return preview;
	}
	function updatePreview() {
		previewContent = getPreviewContent();
	}
	$effect(() => {
		updatePreview();
	});
	async function loadHistory() {
		loadingHistory = true;
		try {
			const result = await apiClient.getPromptHistory(prompt.featureId);
			history = result.history;
			showHistory = true;
		} catch (err) {
			error = 'Failed to load history';
		} finally {
			loadingHistory = false;
		}
	}
	async function handleSave() {
		if (editingContent.trim() === prompt.content.trim()) {
			onClose();
			return;
		}
		saving = true;
		error = '';
		try {
			await onSave(editingContent);
			onClose();
		} catch (err) {
			error = 'Failed to save prompt';
		} finally {
			saving = false;
		}
	}
	function getCategoryName(): string {
		const categoryMap: Record<string, string> = {
			'chat': 'Chat & Conversation',
			'generation': 'Recipe Generation',
			'enhancement': 'Recipe Enhancement',
			'analysis': 'Analysis & Matching'
		};
		const parts = prompt.featureId.split('_');
		const category = parts[parts.length - 1];
		return categoryMap[category] || category;
	}
</script>

<div class="modal-overlay" onclick={onClose}>
	<div class="modal" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<div>
				<h3>Edit Prompt: {prompt.featureId.replace(/_/g, ' ')}</h3>
				{#if prompt.version > 0}
					<span class="version-badge">v{prompt.version}</span>
				{:else}
					<span class="version-badge default">Default</span>
				{/if}
			</div>
			<button class="btn-close" onclick={onClose}>&times;</button>
		</div>
		<div class="modal-body">
			{#if error}
				<div class="error-message">{error}</div>
			{/if}

			{#if prompt.variables.length > 0}
				<div class="variables-section">
					<h4>Available Variables</h4>
					<div class="variables-list">
						{#each prompt.variables as variable}
							<div class="variable-chip">
								<code>{`{{${variable.name}}}`}</code>
								<span class="variable-desc">{variable.description}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="preview-section">
				<h4>Preview (Variables Resolved)</h4>
				<div class="preview-box">
					<pre>{previewContent || 'No content'}</pre>
				</div>
			</div>

			<div class="editor-section">
				<h4>Edit Template</h4>
				<textarea
					bind:value={editingContent}
					rows={15}
					placeholder="Enter prompt template..."
				></textarea>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn-secondary" onclick={loadHistory} disabled={loadingHistory}>
				{loadingHistory ? 'Loading...' : 'History'}
			</button>
			<button class="btn-secondary" onclick={onClose}>Cancel</button>
			<button class="btn-primary" onclick={handleSave} disabled={saving}>
				{saving ? 'Saving...' : 'Save Changes'}
			</button>
		</div>
	</div>
</div>

{#if showHistory}
	<div class="modal-overlay" onclick={() => showHistory = false}>
		<div class="modal history-modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Version History: {prompt.featureId.replace(/_/g, ' ')}</h3>
				<button class="btn-close" onclick={() => showHistory = false}>&times;</button>
			</div>
			<div class="modal-body">
				{#if history.length === 0}
					<p class="empty-history">No version history available.</p>
				{:else}
					<div class="history-list">
						{#each history as entry}
							<div class="history-entry" class:current={entry.version === prompt.version}>
								<div class="history-header">
									<span class="version">v{entry.version}</span>
									{#if entry.version === prompt.version}
										<span class="current-badge">Current</span>
									{/if}
									<span class="history-meta">
										{entry.changedByUsername || 'Unknown'} &bull;
										{new Date(entry.changedAt).toLocaleDateString()}
									</span>
								</div>
								<div class="history-content">
									<pre>{entry.content}</pre>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button class="btn-secondary" onclick={() => showHistory = false}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
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
		max-width: 700px;
		max-height: 90vh;
		overflow: auto;
		box-shadow: var(--shadow-lg);
	}
	.history-modal {
		max-width: 800px;
	}
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--color-border);
	}
	.modal-header div {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
		text-transform: capitalize;
	}
	.version-badge {
		padding: 0.2rem 0.5rem;
		background: var(--color-bg-subtle);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		color: var(--color-text-light);
	}
	.version-badge.default {
		background: #dbeafe;
		color: #1e40af;
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
	.error-message {
		background: #fef2f2;
		color: #dc2626;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		margin-bottom: 1rem;
	}
	.variables-section {
		margin-bottom: 1.5rem;
	}
	.variables-section h4,
	.preview-section h4,
	.editor-section h4 {
		font-size: 0.9rem;
		color: var(--color-text-light);
		margin: 0 0 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.variables-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.variable-chip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		background: var(--color-bg-subtle);
		border-radius: var(--radius-md);
		font-size: 0.85rem;
	}
	.variable-chip code {
		background: white;
		padding: 0.1rem 0.3rem;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		color: var(--color-primary);
	}
	.variable-desc {
		color: var(--color-text-light);
		font-size: 0.8rem;
	}
	.preview-section {
		margin-bottom: 1.5rem;
	}
	.preview-box {
		background: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 1rem;
		max-height: 200px;
		overflow: auto;
	}
	.preview-box pre {
		margin: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
		font-size: 0.875rem;
		font-family: inherit;
	}
	.editor-section {
		margin-bottom: 1rem;
	}
	.editor-section textarea {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.9rem;
		font-family: inherit;
		resize: vertical;
		box-sizing: border-box;
	}
	.editor-section textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}
	.modal-footer {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-bg-subtle);
	}
	.btn-primary {
		padding: 0.75rem 1.5rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		cursor: pointer;
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-dark);
	}
	.btn-primary:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
	.btn-secondary {
		padding: 0.75rem 1rem;
		background: white;
		color: var(--color-text);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-weight: 600;
		cursor: pointer;
	}
	.btn-secondary:hover:not(:disabled) {
		border-color: var(--color-primary);
	}
	.btn-secondary:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.history-entry {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
	.history-entry.current {
		border-color: var(--color-primary);
	}
	.history-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg-subtle);
		border-bottom: 1px solid var(--color-border);
	}
	.history-header .version {
		font-weight: 600;
	}
	.current-badge {
		padding: 0.15rem 0.5rem;
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-full);
		font-size: 0.7rem;
		font-weight: 600;
	}
	.history-meta {
		color: var(--color-text-light);
		font-size: 0.85rem;
		margin-left: auto;
	}
	.history-content {
		padding: 1rem;
		max-height: 200px;
		overflow: auto;
	}
	.history-content pre {
		margin: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
		font-size: 0.85rem;
		font-family: inherit;
	}
	.empty-history {
		text-align: center;
		color: var(--color-text-light);
		padding: 2rem;
	}
</style>
