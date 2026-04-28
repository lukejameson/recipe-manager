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

/**
 * Google Gemini API provider
 * Implements LLMProvider interface for Google's Generative AI API
 */
export class GoogleProvider implements LLMProvider, ImageProvider {
	readonly id = 'google';
	readonly name = 'Google AI';
	readonly supportsVision = true;
	readonly supportsStreaming = false;

	private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

	/**
	 * Known Gemini models with metadata
	 * Used as fallback if API fetch fails
	 */
	private readonly knownModels: ProviderModel[] = [
		{
			id: 'gemini-2.5-flash-preview-05-20',
			name: 'Gemini 2.5 Flash',
			contextWindow: 1000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: {
				input: 0.15,
				output: 0.60
			}
		},
		{
			id: 'gemini-2.5-pro-preview-05-20',
			name: 'Gemini 2.5 Pro',
			contextWindow: 1000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: {
				input: 1.25,
				output: 10.00
			}
		},
		{
			id: 'gemini-1.5-flash',
			name: 'Gemini 1.5 Flash',
			contextWindow: 1000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: {
				input: 0.075,
				output: 0.30
			}
		},
		{
			id: 'gemini-1.5-flash-8b',
			name: 'Gemini 1.5 Flash 8B',
			contextWindow: 1000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: {
				input: 0.0375,
				output: 0.15
			}
		},
		{
			id: 'gemini-1.5-pro',
			name: 'Gemini 1.5 Pro',
			contextWindow: 2000000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: {
				input: 1.25,
				output: 5.00
			}
		}
	];

	/**
	 * Fetch available models from Google API
	 */
	async fetchModels(apiKey: string): Promise<ProviderModel[]> {
		try {
			const response = await fetch(
				`${this.baseUrl}/models?key=${apiKey}`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);

			if (!response.ok) {
				console.warn('Failed to fetch Google models, using known models');
				return [...this.knownModels];
			}

			const data = await response.json();
			const models = data.models || [];

			// Filter to Gemini models and map to our format
			return models
				.filter((m: { name: string }) => m.name.includes('gemini'))
				.map((m: {
					name: string;
					displayName?: string;
					inputTokenLimit?: number;
					outputTokenLimit?: number;
				}) => {
					const modelId = m.name.replace('models/', '');
					const known = this.knownModels.find(k => k.id === modelId);

					if (known) return known;

					// Default metadata for unknown Gemini models
					return {
						id: modelId,
						name: m.displayName || modelId,
						contextWindow: m.inputTokenLimit || 1000000,
						supportsVision: modelId.includes('vision') || !modelId.includes('embedding'),
						supportsJsonMode: true,
						pricing: { input: 0.5, output: 1.5 }
					};
				});
		} catch (error) {
			console.warn('Error fetching Google models:', error);
			return [...this.knownModels];
		}
	}

	/**
	 * Validate API key by making a test request
	 */
	async validateApiKey(apiKey: string): Promise<boolean> {
		try {
			const response = await fetch(
				`${this.baseUrl}/models?key=${apiKey}`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Generate a completion using Gemini API
	 */
	async generate(options: GenerationOptions): Promise<GenerationResult> {
		const apiKey = options.apiKey;
		if (!apiKey) {
			throw new Error('Google API key not configured');
		}

		const url = `${this.baseUrl}/models/${options.model}:generateContent?key=${apiKey}`;

		const contents = this.mapToGeminiContents(options.messages, options.images);
		const generationConfig = this.mapToGeminiGenerationConfig(options);

		const body: Record<string, unknown> = {
			contents,
			generationConfig
		};

		// Add system prompt if provided
		if (options.systemPrompt) {
			body.systemInstruction = {
				parts: [{ text: options.systemPrompt }]
			};
		}

		// Add safety settings to allow more permissive responses
		body.safetySettings = [
			{
				category: 'HARM_CATEGORY_HARASSMENT',
				threshold: 'BLOCK_MEDIUM_AND_ABOVE'
			},
			{
				category: 'HARM_CATEGORY_HATE_SPEECH',
				threshold: 'BLOCK_MEDIUM_AND_ABOVE'
			},
			{
				category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
				threshold: 'BLOCK_MEDIUM_AND_ABOVE'
			},
			{
				category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
				threshold: 'BLOCK_MEDIUM_AND_ABOVE'
			}
		];

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Google API error: ${response.status} ${error}`);
		}

		const data = await response.json();

		// Extract content from response
		const candidate = data.candidates?.[0];
		if (!candidate) {
			throw new Error('No response from Gemini API');
		}

		const content = candidate.content?.parts?.[0]?.text || '';
		const finishReason = candidate.finishReason;

		// Extract usage if available
		const usage = data.usageMetadata
			? {
					inputTokens: data.usageMetadata.promptTokenCount || 0,
					outputTokens: data.usageMetadata.candidatesTokenCount || 0
				}
			: undefined;

		return {
			content,
			usage,
			finishReason
		};
	}

	/**
	 * Generate a streaming completion
	 * Note: Gemini supports streaming but we return an error for now
	 */
	async *generateStream(_options: GenerationOptions): AsyncIterable<StreamChunk> {
		throw new Error('Streaming not implemented for Google provider');
	}

	async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
		const apiKey = options.apiKey;
		if (!apiKey) {
			throw new Error('Google API key not configured');
		}

		const url = `${this.baseUrl}/models/${options.model}:predict?key=${apiKey}`;

		const aspectRatioMap: Record<string, { width: number; height: number }> = {
			'1:1': { width: 1024, height: 1024 },
			'4:3': { width: 1024, height: 768 },
			'16:9': { width: 1024, height: 576 }
		};
		const resolution = aspectRatioMap[options.aspectRatio || '1:1'];

		const body = {
			instances: [{ prompt: options.prompt }],
			params: {
				numberOfImages: 1,
				aspectRatio: options.aspectRatio || '1:1',
				personGeneration: 'dont_allow'
			}
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Google Image Generation API error: ${response.status} ${error}`);
		}

		const data = await response.json();

		if (!data.predictions || !data.predictions[0]) {
			throw new Error('No image generated from API');
		}

		const prediction = data.predictions[0];
		const base64Image = prediction.bytesBase64Encoded;

		if (!base64Image) {
			throw new Error('No image data in API response');
		}

		return {
			imageData: base64Image,
			mimeType: 'image/png',
			width: resolution.width,
			height: resolution.height,
			finishReason: 'SUCCESS'
		};
	}

	/**
	 * Estimate the cost of a request in USD
	 */
	estimateCost(model: string, inputTokens: number, outputTokens: number): number {
		const modelInfo = this.knownModels.find((m) => m.id === model);
		if (!modelInfo) {
			// Default pricing if model not found
			return (inputTokens * 0.5 + outputTokens * 1.5) / 1000000;
		}

		const inputCost = (inputTokens * modelInfo.pricing.input) / 1000000;
		const outputCost = (outputTokens * modelInfo.pricing.output) / 1000000;

		return inputCost + outputCost;
	}

	/**
	 * Convert messages to Gemini contents format
	 */
	private mapToGeminiContents(
		messages: Message[],
		images?: { mimeType: string; data: string }[]
	): Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> {
		const contents = [];

		for (const message of messages) {
			const role = message.role === 'assistant' ? 'model' : 'user';
			const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
				{ text: message.content }
			];

			// Add images to the last user message if provided
			if (role === 'user' && images && images.length > 0 && message === messages[messages.length - 1]) {
				for (const image of images) {
					parts.push({
						inlineData: {
							mimeType: image.mimeType,
							data: image.data
						}
					});
				}
			}

			contents.push({ role, parts });
		}

		return contents;
	}

	/**
	 * Map generation options to Gemini generation config
	 */
	private mapToGeminiGenerationConfig(options: GenerationOptions): Record<string, unknown> {
		const config: Record<string, unknown> = {};

		if (options.maxTokens !== undefined) {
			config.maxOutputTokens = options.maxTokens;
		}

		if (options.temperature !== undefined) {
			config.temperature = options.temperature;
		}

		if (options.jsonMode) {
			config.responseMimeType = 'application/json';
		}

		return config;
	}
}

export default GoogleProvider;
