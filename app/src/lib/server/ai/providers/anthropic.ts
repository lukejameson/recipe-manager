import type {
	LLMProvider,
	ProviderModel,
	GenerationOptions,
	GenerationResult,
	StreamChunk,
	Message
} from './base.js';

/**
 * Anthropic Claude provider implementation
 */
export class AnthropicProvider implements LLMProvider {
	readonly id = 'anthropic';
	readonly name = 'Anthropic';
	readonly supportsVision = true;
	readonly supportsStreaming = false;

	private readonly baseUrl = 'https://api.anthropic.com/v1';

	// Known Anthropic models with metadata
	private readonly knownModels: ProviderModel[] = [
		{
			id: 'claude-3-5-sonnet-20241022',
			name: 'Claude 3.5 Sonnet',
			contextWindow: 200000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 3.0, output: 15.0 }
		},
		{
			id: 'claude-3-5-haiku-20241022',
			name: 'Claude 3.5 Haiku',
			contextWindow: 200000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 0.8, output: 4.0 }
		},
		{
			id: 'claude-3-opus-20240229',
			name: 'Claude 3 Opus',
			contextWindow: 200000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 15.0, output: 75.0 }
		},
		{
			id: 'claude-3-haiku-20240307',
			name: 'Claude 3 Haiku',
			contextWindow: 200000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 0.25, output: 1.25 }
		}
	];

	async fetchModels(apiKey: string): Promise<ProviderModel[]> {
		try {
			const response = await fetch(`${this.baseUrl}/models`, {
				method: 'GET',
				headers: {
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01'
				}
			});

			if (!response.ok) {
				console.warn('Failed to fetch Anthropic models, using known models');
				return this.knownModels;
			}

			const data = await response.json();
			const modelIds: string[] = data.data?.map((m: { id: string }) => m.id) || [];

			// Map known models, filtering by what's available
			return this.knownModels.filter((m) => modelIds.includes(m.id));
		} catch (error) {
			console.warn('Error fetching Anthropic models:', error);
			return this.knownModels;
		}
	}

	async validateApiKey(apiKey: string): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/models`, {
				method: 'GET',
				headers: {
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01'
				}
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	async generate(options: GenerationOptions): Promise<GenerationResult> {
		const { model, systemPrompt, messages, maxTokens, temperature, jsonMode, images } = options;

		const requestBody: Record<string, unknown> = {
			model,
			max_tokens: maxTokens ?? 4096,
			messages: this.mapMessages(messages, images)
		};

		if (systemPrompt) {
			requestBody.system = systemPrompt;
		}

		if (temperature !== undefined) {
			requestBody.temperature = temperature;
		}

		// Anthropic doesn't have native JSON mode, but we can prompt for it
		if (jsonMode && systemPrompt) {
			requestBody.system = `${systemPrompt}\n\nRespond with valid JSON only.`;
		}

		const response = await fetch(`${this.baseUrl}/messages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': options.apiKey || '',
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Anthropic API error: ${error}`);
		}

		const data = await response.json();

		return {
			content: data.content?.[0]?.text || '',
			usage: {
				inputTokens: data.usage?.input_tokens || 0,
				outputTokens: data.usage?.output_tokens || 0
			},
			finishReason: data.stop_reason
		};
	}

	async *generateStream(options: GenerationOptions): AsyncIterable<StreamChunk> {
		// Anthropic streaming not yet implemented
		// Fall back to non-streaming
		const result = await this.generate(options);
		yield {
			content: result.content,
			isDone: true
		};
	}

	estimateCost(model: string, inputTokens: number, outputTokens: number): number {
		const modelInfo = this.knownModels.find((m) => m.id === model);
		if (!modelInfo) return 0;

		const inputCost = (inputTokens / 1_000_000) * modelInfo.pricing.input;
		const outputCost = (outputTokens / 1_000_000) * modelInfo.pricing.output;
		return inputCost + outputCost;
	}

	private mapMessages(
		messages: Message[],
		images?: { mimeType: string; data: string }[]
	): Array<Record<string, unknown>> {
		return messages.map((msg, index) => {
			// First user message can include images
			if (msg.role === 'user' && index === 0 && images && images.length > 0) {
				return {
					role: 'user',
					content: [
						...images.map((img) => ({
							type: 'image',
							source: {
								type: 'base64',
								media_type: img.mimeType,
								data: img.data
							}
						})),
						{ type: 'text', text: msg.content }
					]
				};
			}

			return {
				role: msg.role,
				content: msg.content
			};
		});
	}
}

export default AnthropicProvider;
