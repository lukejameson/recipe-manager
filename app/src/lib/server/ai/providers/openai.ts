import type {
	LLMProvider,
	ProviderModel,
	GenerationOptions,
	GenerationResult,
	StreamChunk,
	Message,
	ImageData
} from './base.js';

export class OpenAIProvider implements LLMProvider {
	readonly id = 'openai';
	readonly name = 'OpenAI';
	readonly supportsVision = true;
	readonly supportsStreaming = true;

	private readonly baseUrl = 'https://api.openai.com/v1';

	// Known OpenAI models with metadata (pricing per 1M tokens)
	private readonly knownModels: ProviderModel[] = [
		{
			id: 'gpt-4o',
			name: 'GPT-4o',
			contextWindow: 128000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 2.50, output: 10.00 }
		},
		{
			id: 'gpt-4o-mini',
			name: 'GPT-4o Mini',
			contextWindow: 128000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 0.15, output: 0.60 }
		},
		{
			id: 'gpt-4-turbo-preview',
			name: 'GPT-4 Turbo',
			contextWindow: 128000,
			supportsVision: true,
			supportsJsonMode: true,
			pricing: { input: 10.00, output: 30.00 }
		},
		{
			id: 'gpt-4',
			name: 'GPT-4',
			contextWindow: 8192,
			supportsVision: false,
			supportsJsonMode: true,
			pricing: { input: 30.00, output: 60.00 }
		},
		{
			id: 'gpt-3.5-turbo',
			name: 'GPT-3.5 Turbo',
			contextWindow: 16385,
			supportsVision: false,
			supportsJsonMode: true,
			pricing: { input: 0.50, output: 1.50 }
		}
	];

	async fetchModels(apiKey: string): Promise<ProviderModel[]> {
		try {
			const response = await fetch(`${this.baseUrl}/models`, {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
			});
			if (!response.ok) return this.knownModels;
			const data = await response.json();
			const models = data.data || [];
			return models
				.filter((m: { id: string }) => m.id.startsWith('gpt-'))
				.map((m: { id: string }) => {
					const known = this.knownModels.find(k => k.id === m.id);
					if (known) return known;
					return {
						id: m.id, name: m.id, contextWindow: 4096,
						supportsVision: m.id.includes('vision') || m.id.includes('4o'),
						supportsJsonMode: true, pricing: { input: 10.00, output: 30.00 }
					};
				});
		} catch (error) {
			console.error('Error fetching OpenAI models:', error);
			return this.knownModels;
		}
	}

	async validateApiKey(apiKey: string): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/models`, {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
			});
			return response.ok;
		} catch (error) {
			console.error('Error validating OpenAI API key:', error);
			return false;
		}
	}

	async generate(options: GenerationOptions): Promise<GenerationResult> {
		const baseUrl = options.baseUrl ?? this.baseUrl;
		const messages = options.images?.length
			? this.mapToOpenAIVisionFormat(options.messages, options.images, options.systemPrompt)
			: this.mapToOpenAIMessages(options.messages, options.systemPrompt);
		const body: Record<string, unknown> = {
			model: options.model, messages,
			temperature: options.temperature ?? 0.7,
			max_tokens: options.maxTokens ?? 4096
		};
		if (options.jsonMode) body.response_format = { type: 'json_object' };
		const response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`);
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
			? this.mapToOpenAIVisionFormat(options.messages, options.images, options.systemPrompt)
			: this.mapToOpenAIMessages(options.messages, options.systemPrompt);
		const body: Record<string, unknown> = {
			model: options.model, messages, stream: true,
			temperature: options.temperature ?? 0.7,
			max_tokens: options.maxTokens ?? 4096
		};
		if (options.jsonMode) body.response_format = { type: 'json_object' };
		const response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`);
		if (!response.body) throw new Error('No response body from OpenAI API');
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) { yield { content: '', isDone: true }; break; }
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;
					if (trimmed === 'data: [DONE]') { yield { content: '', isDone: true }; return; }
					if (trimmed.startsWith('data: ')) {
						try {
							const json = JSON.parse(trimmed.slice(6));
							const content = json.choices?.[0]?.delta?.content ?? '';
							if (content) yield { content, isDone: false };
						} catch { /* ignore parse errors */ }
					}
				}
			}
		} finally { reader.releaseLock(); }
	}

	estimateCost(model: string, inputTokens: number, outputTokens: number): number {
		const modelData = this.knownModels.find(m => m.id === model);
		if (!modelData) return (inputTokens * 10.00 + outputTokens * 30.00) / 1_000_000;
		return (inputTokens * modelData.pricing.input + outputTokens * modelData.pricing.output) / 1_000_000;
	}

	private mapToOpenAIMessages(messages: Message[], systemPrompt?: string): unknown[] {
		const result: unknown[] = [];
		if (systemPrompt) result.push({ role: 'system', content: systemPrompt });
		for (const msg of messages) result.push({ role: msg.role, content: msg.content });
		return result;
	}

	private mapToOpenAIVisionFormat(messages: Message[], images: ImageData[], systemPrompt?: string): unknown[] {
		const result: unknown[] = [];
		if (systemPrompt) result.push({ role: 'system', content: systemPrompt });
		for (let i = 0; i < messages.length - 1; i++) result.push({ role: messages[i].role, content: messages[i].content });
		const last = messages[messages.length - 1];
		if (last?.role === 'user') {
			const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [{ type: 'text', text: last.content }];
			for (const img of images) content.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
			result.push({ role: 'user', content });
		} else if (last) result.push({ role: last.role, content: last.content });
		return result;
	}
}

export default OpenAIProvider;
