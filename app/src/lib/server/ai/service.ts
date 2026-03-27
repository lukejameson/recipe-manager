import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/db';
import { settings } from '$lib/server/db/schema';
import { decrypt } from '$lib/server/utils/encryption';

class AIService {
	private apiKey: string | null = null;
	private model: string | null = null;
	private secondaryModel: string | null = null;
	private availableModels: string[] = [];
	private initialized = false;

	async initialize(): Promise<boolean> {
		if (this.initialized) {
			return this.apiKey !== null;
		}

		try {
			const db = getDb();
			const [appSettings] = await db
				.select()
				.from(settings)
				.where(eq(settings.id, 'app-settings'))
				.limit(1);

			if (!appSettings?.anthropicApiKey) {
				this.apiKey = null;
				this.initialized = true;
				return false;
			}

			// Try to decrypt the key. If it fails, check if it's a plaintext key
			try {
				this.apiKey = decrypt(appSettings.anthropicApiKey);
			} catch (decryptError) {
				// If decryption fails, check if it's a plaintext API key (starts with sk-)
				if (appSettings.anthropicApiKey.startsWith('sk-')) {
					this.apiKey = appSettings.anthropicApiKey;
				} else {
					console.error('Failed to decrypt API key and it does not appear to be a valid plaintext key');
					this.apiKey = null;
					this.initialized = true;
					return false;
				}
			}

			// Fetch available models from Anthropic API
			await this.fetchModels();

			// Use configured models or pick from available
			this.model = appSettings.anthropicModel || this.selectDefaultModel();
			this.secondaryModel = appSettings.anthropicSecondaryModel || this.selectSecondaryModel();

			this.initialized = true;
			return true;
		} catch (error) {
			console.error('Failed to initialize AI service:', error);
			this.apiKey = null;
			this.initialized = true;
			return false;
		}
	}

	private async fetchModels(): Promise<void> {
		if (!this.apiKey) return;

		try {
			const response = await fetch('https://api.anthropic.com/v1/models', {
				method: 'GET',
				headers: {
					'x-api-key': this.apiKey,
					'anthropic-version': '2023-06-01',
				},
			});

			if (!response.ok) {
				console.error('Failed to fetch models from Anthropic API');
				return;
			}

			const data = await response.json();
			this.availableModels = data.data?.map((m: any) => m.id) || [];
		} catch (error) {
			console.error('Error fetching models:', error);
		}
	}

	private selectDefaultModel(): string {
		// Prefer claude-3-5-sonnet, then claude-3-opus, then first available
		const preferences = [
			'claude-3-5-sonnet-20241022',
			'claude-3-5-sonnet-20240620',
			'claude-3-opus-20240229',
		];

		for (const model of preferences) {
			if (this.availableModels.includes(model)) {
				return model;
			}
		}

		// Fallback to first available or hardcoded default
		return this.availableModels[0] || 'claude-3-5-sonnet-20241022';
	}

	private selectSecondaryModel(): string {
		// Prefer haiku models for secondary/fast tasks
		const preferences = [
			'claude-3-5-haiku-20241022',
			'claude-3-haiku-20240307',
		];

		for (const model of preferences) {
			if (this.availableModels.includes(model)) {
				return model;
			}
		}

		// Fallback to same as primary if no haiku available
		return this.model || 'claude-3-haiku-20240307';
	}

	isConfigured(): boolean {
		return this.apiKey !== null;
	}

	getApiKey(): string {
		if (!this.apiKey) {
			throw new Error('AI service not configured');
		}
		return this.apiKey;
	}

	getModel(): string {
		if (!this.model) {
			throw new Error('AI service not configured');
		}
		return this.model;
	}

	getSecondaryModel(): string {
		if (!this.secondaryModel) {
			throw new Error('AI service not configured');
		}
		return this.secondaryModel;
	}

	getAvailableModels(): string[] {
		return [...this.availableModels];
	}

	reset(): void {
		this.apiKey = null;
		this.model = null;
		this.secondaryModel = null;
		this.availableModels = [];
		this.initialized = false;
	}
}

export const aiService = new AIService();
