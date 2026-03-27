import type {
	LLMProvider,
	ProviderModel,
	GenerationOptions,
	GenerationResult,
	StreamChunk,
	Message,
	ImageData
} from './base.js';

/**
 * Generic OpenAI-compatible provider for self-hosted models
 * Supports Ollama, vLLM, llama.cpp server, and other OpenAI-compatible APIs
 */
export class OpenAICompatibleProvider implements LLMProvider {
	readonly id = 'openai-compatible';
	readonly name = 'OpenAI-Compatible';
	readonly supportsVision: boolean;
	readonly supportsStreaming = true;

	private readonly defaultBaseUrl: string;

	constructor(baseUrl?: string) {
		this.defaultBaseUrl = baseUrl || 'http://localhost:11434/v1';
		// Vision support depends on the underlying model
		// We'll set this to true and let the actual model handle it
		this.supportsVision = true;
	}

	/**
	 * Get the base URL for API calls
	 */
	private getBaseUrl(optionsBaseUrl?: string): string {
		return optionsBaseUrl || this.defaultBaseUrl;
	}

	async fetchModels(apiKey: string, baseUrl?: string): Promise<ProviderModel[]> {
		const url = this.getBaseUrl(baseUrl);

		try {
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			if (apiKey) {
				headers['Authorization'] = `Bearer ${apiKey}`;
			}

			const response = await fetch(`${url}/models`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				console.warn('Failed to fetch models from OpenAI-compatible API');
				return [];
			}

			const data = await response.json();
			const models = data.data || [];

			return models.map((m: { id: string; context_length?: number }) => ({
				id: m.id,
				name: m.id,
				contextWindow: m.context_length || 4096,
				supportsVision: false, // Conservative default for self-hosted models
				supportsJsonMode: true,
				pricing: { input: 0, output: 0 } // Self-hosted = no API costs
			}));
		} catch (error) {
			console.warn('Error fetching models from OpenAI-compatible API:', error);
			return [];
		}
	}

	async validateApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
		const url = this.getBaseUrl(baseUrl);

		try {
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			if (apiKey) {
				headers['Authorization'] = `Bearer ${apiKey}`;
			}

			const response = await fetch(`${url}/models`, {
				method: 'GET',
				headers
			});

			return response.ok;
		} catch {
			return false;
		}
	}

	async generate(options: GenerationOptions): Promise<GenerationResult> {
		const baseUrl = this.getBaseUrl(options.baseUrl);
		const messages = options.images?.length
			? this.mapToVisionFormat(options.messages, options.images, options.systemPrompt)
			: this.mapToMessages(options.messages, options.systemPrompt);

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
			'Content-Type': 'application/json'
		};

		if (options.apiKey) {
			headers['Authorization'] = `Bearer ${options.apiKey}`;
		}

		const response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenAI-compatible API error: ${error}`);
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
		const baseUrl = this.getBaseUrl(options.baseUrl);
		const messages = options.images?.length
			? this.mapToVisionFormat(options.messages, options.images, options.systemPrompt)
			: this.mapToMessages(options.messages, options.systemPrompt);

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
			'Content-Type': 'application/json'
		};

		if (options.apiKey) {
			headers['Authorization'] = `Bearer ${options.apiKey}`;
		}

		const response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenAI-compatible API error: ${error}`);
		}

		if (!response.body) {
			throw new Error('No response body');
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
							// Ignore parse errors
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	estimateCost(_model: string, _inputTokens: number, _outputTokens: number): number {
		// Self-hosted models have no per-token API cost
		return 0;
	}

	private mapToMessages(messages: Message[], systemPrompt?: string): unknown[] {
		const result: unknown[] = [];
		if (systemPrompt) {
			result.push({ role: 'system', content: systemPrompt });
		}
		for (const msg of messages) {
			result.push({ role: msg.role, content: msg.content });
		}
		return result;
	}

	private mapToVisionFormat(
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

export default OpenAICompatibleProvider;
