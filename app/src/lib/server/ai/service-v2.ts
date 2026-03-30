import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/db.js';
import { providerConfigs, featureModelConfigs } from '../db/schema.js';
import {
	providerRegistry,
	AnthropicProvider,
	OpenAIProvider,
	GoogleProvider,
	OpenRouterProvider,
	OpenAICompatibleProvider,
	type GenerationOptions,
	type GenerationResult,
	type StreamChunk,
	type ProviderModel
} from '../ai/providers/index.js';
import { AIFeature, DEFAULT_FEATURE_CONFIGS } from '../ai/features.js';
import { decrypt } from '../utils/encryption.js';

/**
 * Unified AI Service V2 with feature-based model routing
 * Supports multiple providers and per-feature configuration
 */
export class AIServiceV2 {
	private static instance: AIServiceV2 | null = null;
	private initialized = false;

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	static async getInstance(): Promise<AIServiceV2> {
		if (!AIServiceV2.instance) {
			AIServiceV2.instance = new AIServiceV2();
			await AIServiceV2.instance.initialize();
		}
		return AIServiceV2.instance;
	}

	/**
	 * Initialize the service and register providers
	 */
	private async initialize(): Promise<void> {
		if (this.initialized) return;

		// Register built-in providers
		providerRegistry.register(new AnthropicProvider());
		providerRegistry.register(new OpenAIProvider());
		providerRegistry.register(new GoogleProvider());
		providerRegistry.register(new OpenRouterProvider());

		// Load custom provider configs and register OpenAI-compatible providers
		const configs = await db.query.providerConfigs?.findMany({
			where: eq(providerConfigs.providerId, 'openai-compatible')
		});

		if (configs) {
			for (const config of configs) {
				if (config.baseUrl) {
					providerRegistry.register(new OpenAICompatibleProvider(config.baseUrl));
				}
			}
		}

		this.initialized = true;
	}

	/**
	 * Get provider configuration from database
	 */
	async getProviderConfig(providerId: string) {
		const configs = await db.query.providerConfigs?.findMany({
			where: eq(providerConfigs.providerId, providerId)
		});
		return configs?.[0] || null;
	}

	/**
	 * Get feature configuration from database
	 */
	async getFeatureConfig(feature: AIFeature) {
		const configs = await db.query.featureModelConfigs?.findMany({
			where: and(
				eq(featureModelConfigs.featureId, feature),
				eq(featureModelConfigs.isEnabled, true)
			),
			orderBy: desc(featureModelConfigs.priority)
		});

		// Return highest priority enabled config, or null if none found
		return configs?.[0] || null;
	}

	/**
	 * Get API key for a provider (decrypted)
	 */
	private async getApiKey(providerId: string): Promise<string | null> {
		const config = await this.getProviderConfig(providerId);
		if (!config?.apiKey) return null;

		try {
			return decrypt(config.apiKey);
		} catch {
			// If decryption fails, return as-is (may be unencrypted for testing)
			return config.apiKey;
		}
	}

	/**
	 * Get base URL for a provider (for OpenAI-compatible providers)
	 */
	private async getBaseUrl(providerId: string): Promise<string | undefined> {
		const config = await this.getProviderConfig(providerId);
		return config?.baseUrl || undefined;
	}

	/**
	 * Generate content for a specific feature
	 * This is the main method for making AI requests
	 */
	async generateForFeature(
		feature: AIFeature,
		options: Omit<GenerationOptions, 'model' | 'apiKey'>
	): Promise<GenerationResult> {
		let config = await this.getFeatureConfig(feature);

		if (!config) {
			// Fallback: find any existing feature config to use as template
			const allFeatureConfigs = await db.select().from(featureModelConfigs).limit(1);
			if (allFeatureConfigs.length === 0) {
				throw new Error('No AI feature configurations found. Please configure features in Settings.');
			}
			// Use the first available config as fallback template
			config = allFeatureConfigs[0];
			console.warn(`[AIServiceV2] No config for ${feature}, using config from ${config.featureId} as fallback`);
		}

		const provider = providerRegistry.get(config.providerId);

		if (!provider) {
			throw new Error(`Provider not found: ${config.providerId}`);
		}

		const apiKey = await this.getApiKey(config.providerId);

		if (!apiKey) {
			throw new Error(`No API key configured for provider: ${config.providerId}`);
		}

		const baseUrl = await this.getBaseUrl(config.providerId);

		// Get default temperature/maxTokens from feature defaults if not in config
		const defaults = DEFAULT_FEATURE_CONFIGS[feature];
		const temperature = config.temperature !== null
			? config.temperature / 100 // Convert from integer (e.g., 70 -> 0.7)
			: defaults?.temperature ?? 0.7;
		const maxTokens = config.maxTokens ?? defaults?.maxTokens ?? 4096;

		const fullOptions: GenerationOptions = {
			...options,
			apiKey,
			model: config.modelId,
			temperature,
			maxTokens,
			baseUrl
		};

		return provider.generate(fullOptions);
	}

	/**
	 * Generate streaming content for a specific feature
	 */
	async *generateStreamForFeature(
		feature: AIFeature,
		options: Omit<GenerationOptions, 'model' | 'apiKey'>
	): AsyncIterable<StreamChunk> {
		const config = await this.getFeatureConfig(feature);

		if (!config) {
			throw new Error(`No configuration found for feature: ${feature}`);
		}

		const provider = providerRegistry.get(config.providerId);

		if (!provider) {
			throw new Error(`Provider not found: ${config.providerId}`);
		}

		// Check if provider supports streaming
		if (!provider.supportsStreaming) {
			// Fall back to non-streaming and yield single result
			const result = await this.generateForFeature(feature, options);
			yield { content: result.content, isDone: true };
			return;
		}

		const apiKey = await this.getApiKey(config.providerId);

		if (!apiKey) {
			throw new Error(`No API key configured for provider: ${config.providerId}`);
		}

		const baseUrl = await this.getBaseUrl(config.providerId);

		const defaults = DEFAULT_FEATURE_CONFIGS[feature];
		const temperature = config.temperature !== null
			? config.temperature / 100
			: defaults?.temperature ?? 0.7;
		const maxTokens = config.maxTokens ?? defaults?.maxTokens ?? 4096;

		const fullOptions: GenerationOptions = {
			...options,
			apiKey,
			model: config.modelId,
			temperature,
			maxTokens,
			baseUrl
		};

		yield* provider.generateStream!(fullOptions);
	}

	/**
	 * Estimate cost for a feature request
	 */
	async estimateCost(
		feature: AIFeature,
		inputTokens: number,
		outputTokens: number
	): Promise<number> {
		const config = await this.getFeatureConfig(feature);

		if (!config) {
			return 0;
		}

		const provider = providerRegistry.get(config.providerId);

		if (!provider) {
			return 0;
		}

		return provider.estimateCost(config.modelId, inputTokens, outputTokens);
	}

	/**
	 * Validate that a feature configuration will work
	 */
	async validateFeatureConfig(feature: AIFeature): Promise<{
		valid: boolean;
		error?: string;
		warnings?: string[];
	}> {
		const warnings: string[] = [];

		const config = await this.getFeatureConfig(feature);

		if (!config) {
			return { valid: false, error: `No configuration found for feature: ${feature}` };
		}

		const provider = providerRegistry.get(config.providerId);

		if (!provider) {
			return { valid: false, error: `Provider not found: ${config.providerId}` };
		}

		const apiKey = await this.getApiKey(config.providerId);

		if (!apiKey) {
			return { valid: false, error: `No API key configured for provider: ${config.providerId}` };
		}

		// Check vision capability for features that require it
		const defaults = DEFAULT_FEATURE_CONFIGS[feature];
		if (defaults?.requiresVision && !provider.supportsVision) {
			return {
				valid: false,
				error: `Feature ${feature} requires vision support, but provider ${config.providerId} does not support vision`
			};
		}

		// Check if configured model likely supports vision (best effort)
		if (defaults?.requiresVision) {
			const hasVisionModel = config.modelId.includes('vision') ||
				config.modelId.includes('claude-3') ||
				config.modelId.includes('gpt-4o') ||
				config.modelId.includes('gemini');

			if (!hasVisionModel) {
				warnings.push(`Model ${config.modelId} may not support vision. Consider using a vision-capable model.`);
			}
		}

		return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
	}

	/**
	 * Get all available providers with their configuration status
	 */
	async getAvailableProviders(): Promise<Array<{
		id: string;
		name: string;
		configured: boolean;
		enabled: boolean;
		supportsVision: boolean;
		supportsStreaming: boolean;
	}>> {
		const providers = providerRegistry.getAll();

		return Promise.all(
			providers.map(async (provider) => {
				const config = await this.getProviderConfig(provider.id);
				return {
					id: provider.id,
					name: provider.name,
					configured: !!config?.apiKey,
					enabled: config?.isEnabled ?? false,
					supportsVision: provider.supportsVision,
					supportsStreaming: provider.supportsStreaming
				};
			})
		);
	}

	/**
	 * Get available models for a provider
	 */
	async getAvailableModels(providerId: string): Promise<Array<{
		id: string;
		name: string;
		contextWindow: number;
		supportsVision: boolean;
		supportsJsonMode: boolean;
	}>> {
		const provider = providerRegistry.get(providerId);

		if (!provider) {
			return [];
		}

		const apiKey = await this.getApiKey(providerId);

		if (!apiKey) {
			return [];
		}

		try {
			const models = await provider.fetchModels(apiKey);
			return models.map((m: ProviderModel) => ({
				id: m.id,
				name: m.name,
				contextWindow: m.contextWindow,
				supportsVision: m.supportsVision,
				supportsJsonMode: m.supportsJsonMode
			}));
		} catch {
			return [];
		}
	}

	/**
	 * Test a provider configuration
	 */
	async testProvider(providerId: string, apiKey: string, baseUrl?: string): Promise<{
		success: boolean;
		error?: string;
	}> {
		const provider = providerRegistry.get(providerId);

		if (!provider) {
			return { success: false, error: `Provider not found: ${providerId}` };
		}

		try {
			// For OpenAI-compatible providers, we need to use baseUrl
			if (providerId === 'openai-compatible' && baseUrl) {
				const compatibleProvider = new OpenAICompatibleProvider(baseUrl);
				const valid = await compatibleProvider.validateApiKey(apiKey, baseUrl);
				return {
					success: valid,
					error: valid ? undefined : 'Invalid API key or base URL'
				};
			}

			const valid = await provider.validateApiKey(apiKey);
			return {
				success: valid,
				error: valid ? undefined : 'Invalid API key'
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Get all feature configurations
	 */
	async getAllFeatureConfigs(): Promise<Array<{
		feature: AIFeature;
		providerId: string;
		modelId: string;
		temperature?: number;
		maxTokens?: number;
		enabled: boolean;
		priority: number;
	}>> {
		const configs = await db.query.featureModelConfigs?.findMany({
			orderBy: desc(featureModelConfigs.priority)
		});

		if (!configs) {
			return [];
		}

		return configs.map(c => ({
			feature: c.featureId as AIFeature,
			providerId: c.providerId,
			modelId: c.modelId,
			temperature: c.temperature !== null ? c.temperature / 100 : undefined,
			maxTokens: c.maxTokens ?? undefined,
			enabled: c.isEnabled,
			priority: c.priority
		}));
	}
}

export default AIServiceV2;
