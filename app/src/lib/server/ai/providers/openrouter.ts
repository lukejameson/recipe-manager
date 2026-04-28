import type {
	LLMProvider,
	ProviderModel,
	GenerationOptions,
	GenerationResult,
	StreamChunk,
	Message,
	ImageData,
	ImageGenerationOptions,
	ImageGenerationResult
} from './base.js';
import type { ImageProvider } from './base.js';
import { AIRateLimitError } from '../../../utils/errors.js';

export class OpenRouterProvider implements LLMProvider, ImageProvider {
	readonly id = 'openrouter';
	readonly name = 'OpenRouter';
	readonly supportsVision = true;
	readonly supportsStreaming = true;
	private readonly baseUrl = 'https://openrouter.ai/api/v1';

	private readonly knownImageModels: ProviderModel[] = [
		{
			id: 'google/gemini-2.5-flash-image',
			name: 'Gemini 2.5 Flash Image (via OpenRouter)',
			contextWindow: 1000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 0.075, output: 0.30 }
		},
		{
			id: 'google/gemini-3-pro-image-preview',
			name: 'Gemini 3 Pro Image (via OpenRouter)',
			contextWindow: 1000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 0.50, output: 2.00 }
		},
		{
			id: 'google/gemini-3.1-flash-image-preview',
			name: 'Gemini 3.1 Flash Image (via OpenRouter)',
			contextWindow: 1000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 0.10, output: 0.40 }
		},
		{
			id: 'black-forest-labs/flux.2-pro',
			name: 'Flux 2 Pro (via OpenRouter)',
			contextWindow: 8192,
			supportsVision: false,
			supportsJsonMode: true,
			pricing: { input: 0.55, output: 0.55 }
		},
		{
			id: 'black-forest-labs/flux.2-flex',
			name: 'Flux 2 Flex (via OpenRouter)',
			contextWindow: 8192,
			supportsVision: false,
			supportsJsonMode: true,
			pricing: { input: 0.30, output: 0.30 }
		},
		{
			id: 'sourceful/riverflow-v2-standard-preview',
			name: 'Riverflow v2 Standard (via OpenRouter)',
			contextWindow: 8192,
			supportsVision: false,
			supportsJsonMode: true,
			pricing: { input: 0.20, output: 0.20 }
		}
	];

	private readonly knownModels: ProviderModel[] = [
		{
			id: 'anthropic/claude-3.5-sonnet',
			name: 'Claude 3.5 Sonnet (via OpenRouter)',
			contextWindow: 200000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 3.0, output: 15.0 }
		},
		{
			id: 'anthropic/claude-3.5-haiku',
			name: 'Claude 3.5 Haiku (via OpenRouter)',
			contextWindow: 200000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 0.8, output: 4.0 }
		},
		{
			id: 'openai/gpt-4o',
			name: 'GPT-4o (via OpenRouter)',
			contextWindow: 128000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 2.5, output: 10.0 }
		},
		{
			id: 'openai/gpt-4o-mini',
			name: 'GPT-4o Mini (via OpenRouter)',
			contextWindow: 128000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 0.15, output: 0.6 }
		},
		{
			id: 'google/gemini-1.5-flash',
			name: 'Gemini 1.5 Flash (via OpenRouter)',
			contextWindow: 1000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 0.075, output: 0.3 }
		},
		{
			id: 'google/gemini-1.5-pro',
			name: 'Gemini 1.5 Pro (via OpenRouter)',
			contextWindow: 2000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 1.25, output: 5.0 }
		},
		{
			id: 'meta-llama/llama-3.1-70b-instruct',
			name: 'Llama 3.1 70B',
			contextWindow: 128000,
			supportsVision: false,
			supportsJsonMode: true,
			pricing: { input: 0.5, output: 0.8 }
		},
		{
			id: 'meta-llama/llama-3.1-8b-instruct',
			name: 'Llama 3.1 8B',
			contextWindow: 128000,
			supportsVision: false,
			supportsJsonMode: true,
			pricing: { input: 0.05, output: 0.1 }
		}
	];

	async fetchModels(apiKey: string, filterImageModels = false): Promise<ProviderModel[]> {
		try {
			const modalityFilter = filterImageModels ? '&output_modalities=image' : '';
			const response = await fetch(`${this.baseUrl}/models${modalityFilter}`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				console.warn('Failed to fetch OpenRouter models, using known models');
				return filterImageModels ? this.knownImageModels : this.knownModels;
			}

			const data = await response.json();
			const models = data.data || [];
			const mapped = models.map((m: {
				id: string;
				name?: string;
				context_length?: number;
				pricing?: { prompt?: number; completion?: number };
				output_modalities?: string[];
			}) => {
				const knownImage = this.knownImageModels.find(k => k.id === m.id);
				if (knownImage) return knownImage;

				const known = this.knownModels.find(k => k.id === m.id);
				if (known) return known;

				const supportsImage = m.output_modalities?.includes('image') ?? false;

				return {
					id: m.id,
					name: m.name || m.id,
					contextWindow: m.context_length || 4096,
					supportsVision: supportsImage ||
						m.id.includes('vision') ||
						m.id.includes('claude-3') ||
						m.id.includes('gpt-4o'),
					supportsJsonMode: true,
					pricing: {
						input: (m.pricing?.prompt || 0) * 1000000,
						output: (m.pricing?.completion || 0) * 1000000
					}
				};
			});
			return this.filterFreeModels(mapped);
		} catch (error) {
			console.warn('Error fetching OpenRouter models:', error);
			return filterImageModels ? this.knownImageModels : this.knownModels;
		}
	}

	private filterFreeModels(models: ProviderModel[]): ProviderModel[] {
		return models.filter(m => !m.id.includes(':free'));
	}

	async fetchImageModels(apiKey: string): Promise<ProviderModel[]> {
		return this.fetchModels(apiKey, true);
	}

	async validateApiKey(apiKey: string): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/models`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				}
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	async generate(options: GenerationOptions): Promise<GenerationResult> {
		const baseUrl = options.baseUrl ?? this.baseUrl;
		const messages = options.images?.length
			? this.mapToOpenRouterVisionFormat(options.messages, options.images, options.systemPrompt)
			: this.mapToOpenRouterMessages(options.messages, options.systemPrompt);

		const body: Record<string, unknown> = {
			model: options.model,
			messages,
			temperature: options.temperature ?? 0.7,
			max_tokens: options.maxTokens ?? 4096
		};

		if (options.jsonMode) {
			body.response_format = { type: 'json_object' };
		}

		const headers: Record<string, string> = {
			'Authorization': `Bearer ${options.apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://recipe-manager.app',
			'X-Title': 'Recipe Manager'
		};

		const response = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
			headers,
			body: JSON.stringify(body)
		});
		if (!response.ok) {
			const errorText = await response.text();
			if (response.status === 429) {
				throw new AIRateLimitError(
					'AI service is temporarily busy. Please try again in a moment.'
				);
			}
			throw new Error(`OpenRouter API error: ${errorText}`);
		}
		const data = await response.json();
		const choice = data.choices?.[0];
		return {
			content: choice?.message?.content ?? '',
			usage: {
				inputTokens: data.usage?.prompt_tokens ?? 0,
				outputTokens: data.usage?.completion_tokens ?? 0
			},
			finishReason: choice?.finish_reason ?? null
		};
	}
	async *generateStream(options: GenerationOptions): AsyncIterable<StreamChunk> {
		const baseUrl = options.baseUrl ?? this.baseUrl;
		const messages = options.images?.length
			? this.mapToOpenRouterVisionFormat(options.messages, options.images, options.systemPrompt)
			: this.mapToOpenRouterMessages(options.messages, options.systemPrompt);

		const body: Record<string, unknown> = {
			model: options.model,
			messages,
			stream: true,
			temperature: options.temperature ?? 0.7,
			max_tokens: options.maxTokens ?? 4096
		};

		if (options.jsonMode) {
			body.response_format = { type: 'json_object' };
		}

		const headers: Record<string, string> = {
			'Authorization': `Bearer ${options.apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://recipe-manager.app',
			'X-Title': 'Recipe Manager'
		};

		const response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenRouter API error: ${error}`);
		}

		if (!response.body) {
			throw new Error('No response body from OpenRouter API');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					yield { content: '', isDone: true };
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || trimmed === 'data: [DONE]') {
						if (trimmed === 'data: [DONE]') {
							yield { content: '', isDone: true };
							return;
						}
						continue;
					}
					if (trimmed.startsWith('data: ')) {
						try {
							const json = JSON.parse(trimmed.slice(6));
							const content = json.choices?.[0]?.delta?.content ?? '';
							if (content) {
								yield { content, isDone: false };
							}
						} catch {
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	estimateCost(model: string, inputTokens: number, outputTokens: number): number {
		const modelData = this.knownModels.find(m => m.id === model) ||
			this.knownImageModels.find(m => m.id === model);
		if (!modelData) {
			return (inputTokens * 5.0 + outputTokens * 15.0) / 1_000_000;
		}
		const inputCost = (inputTokens * modelData.pricing.input) / 1_000_000;
		const outputCost = (outputTokens * modelData.pricing.output) / 1_000_000;
		return inputCost + outputCost;
	}

	async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
		const baseUrl = options.baseUrl ?? this.baseUrl;

		const aspectRatioMap: Record<string, string> = {
			'1:1': '1:1',
			'4:3': '4:3',
			'16:9': '16:9'
		};
		const aspectRatio = aspectRatioMap[options.aspectRatio || '1:1'] || '1:1';

		const body: Record<string, unknown> = {
			model: options.model,
			messages: [
				{
					role: 'user',
					content: options.prompt
				}
			],
			modalities: ['image', 'text'],
			image_config: {
				aspect_ratio: aspectRatio
			}
		};

		const headers: Record<string, string> = {
			'Authorization': `Bearer ${options.apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://recipe-manager.app',
			'X-Title': 'Recipe Manager'
		};

		const response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorText = await response.text();
			if (response.status === 429) {
				let retryAfter: number | undefined;
				try {
					const errorJson = JSON.parse(errorText);
					if (errorJson.error?.metadata?.raw?.includes('retry')) {
						retryAfter = 30;
					}
				} catch {}
				throw new AIRateLimitError(
					'AI service is temporarily busy. Please try again in a moment.',
					retryAfter
				);
			}
			throw new Error(`OpenRouter API error: ${errorText}`);
		}

		const data = await response.json();
		const message = data.choices?.[0]?.message;

		if (!message?.images || message.images.length === 0) {
			throw new Error('No image generated from OpenRouter API');
		}

		const imageInfo = message.images[0];
		const imageUrl = imageInfo?.image_url?.url;

		if (!imageUrl) {
			throw new Error('No image URL in OpenRouter response');
		}

		let base64Image: string;
		if (imageUrl.startsWith('data:')) {
			base64Image = imageUrl.split(',')[1];
		} else {
			const imageResponse = await fetch(imageUrl);
			if (!imageResponse.ok) {
				throw new Error('Failed to fetch generated image');
			}
			const imageBuffer = await imageResponse.arrayBuffer();
			base64Image = Buffer.from(imageBuffer).toString('base64');
		}

		const sizeMap: Record<string, { width: number; height: number }> = {
			'1:1': { width: 1024, height: 1024 },
			'4:3': { width: 1184, height: 864 },
			'16:9': { width: 1344, height: 768 }
		};
		const dimensions = sizeMap[aspectRatio] || { width: 1024, height: 1024 };

		return {
			imageData: base64Image,
			mimeType: 'image/png',
			width: dimensions.width,
			height: dimensions.height,
			finishReason: 'SUCCESS'
		};
	}

	private mapToOpenRouterMessages(messages: Message[], systemPrompt?: string): unknown[] {
		const result: unknown[] = [];
		if (systemPrompt) {
			result.push({ role: 'system', content: systemPrompt });
		}
		for (const msg of messages) {
			result.push({ role: msg.role, content: msg.content });
		}
		return result;
	}

	private mapToOpenRouterVisionFormat(
		messages: Message[],
		images: ImageData[],
		systemPrompt?: string
	): unknown[] {
		const result: unknown[] = [];
		if (systemPrompt) {
			result.push({ role: 'system', content: systemPrompt });
		}
		for (let i = 0; i < messages.length - 1; i++) {
			result.push({
				role: messages[i].role,
				content: messages[i].content
			});
		}

		const lastMessage = messages[messages.length - 1];
		if (lastMessage?.role === 'user') {
			const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
				{ type: 'text', text: lastMessage.content }
			];
			for (const image of images) {
				content.push({
					type: 'image_url',
					image_url: {
						url: `data:${image.mimeType};base64,${image.data}`
					}
				});
			}
			result.push({ role: 'user', content });
		} else if (lastMessage) {
			result.push({
				role: lastMessage.role,
				content: lastMessage.content
			});
		}
		return result;
	}
}

export default OpenRouterProvider;
