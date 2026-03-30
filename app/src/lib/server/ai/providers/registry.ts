import type { LLMProvider } from './base.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GoogleProvider } from './google.js';
import { OpenRouterProvider } from './openrouter.js';

export class ProviderRegistry {
	private providers = new Map<string, LLMProvider>();
	private defaultsInitialized = false;

	register(provider: LLMProvider): void {
		this.providers.set(provider.id, provider);
	}

	get(id: string): LLMProvider | undefined {
		this.ensureDefaultsInitialized();
		return this.providers.get(id);
	}

	getAll(): LLMProvider[] {
		this.ensureDefaultsInitialized();
		return Array.from(this.providers.values());
	}

	getAvailable(apiKeys: Record<string, string>): LLMProvider[] {
		return this.getAll().filter((provider) => apiKeys[provider.id]);
	}

	unregister(id: string): void {
		this.providers.delete(id);
	}

	clear(): void {
		this.providers.clear();
		this.defaultsInitialized = false;
	}

	private ensureDefaultsInitialized(): void {
		if (!this.defaultsInitialized) {
			initializeDefaultProviders();
			this.defaultsInitialized = true;
		}
	}
}

export const providerRegistry = new ProviderRegistry();

export function initializeDefaultProviders(): void {
	providerRegistry.register(new AnthropicProvider());
	providerRegistry.register(new OpenAIProvider());
	providerRegistry.register(new GoogleProvider());
	providerRegistry.register(new OpenRouterProvider());
}
