import type { LLMProvider } from './base.js';

/**
 * Registry for managing LLM providers
 */
export class ProviderRegistry {
	private providers = new Map<string, LLMProvider>();

	/**
	 * Register a provider
	 */
	register(provider: LLMProvider): void {
		this.providers.set(provider.id, provider);
	}

	/**
	 * Get a provider by ID
	 */
	get(id: string): LLMProvider | undefined {
		return this.providers.get(id);
	}

	/**
	 * Get all registered providers
	 */
	getAll(): LLMProvider[] {
		return Array.from(this.providers.values());
	}

	/**
	 * Get providers that have valid API keys configured
	 */
	getAvailable(apiKeys: Record<string, string>): LLMProvider[] {
		return this.getAll().filter((provider) => apiKeys[provider.id]);
	}

	/**
	 * Unregister a provider by ID
	 */
	unregister(id: string): void {
		this.providers.delete(id);
	}

	/**
	 * Clear all registered providers
	 */
	clear(): void {
		this.providers.clear();
	}
}

/**
 * Singleton instance of the provider registry
 */
export const providerRegistry = new ProviderRegistry();

/**
 * Initialize default providers
 * Providers are registered by AIServiceV2 when it's initialized
 */
export function initializeDefaultProviders(): void {
	// Providers are registered by AIServiceV2 when it's initialized
	// This function exists for future extensibility
}
