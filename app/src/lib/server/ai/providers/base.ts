/**
 * Base types and interfaces for LLM providers
 * All providers must implement the LLMProvider interface
 */

/** Supported message roles */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Chat message structure */
export interface Message {
	role: MessageRole;
	content: string;
}

/** Image data for vision models */
export interface ImageData {
	mimeType: string;
	data: string; // base64 encoded
}

/** Model information from a provider */
export interface ProviderModel {
	id: string;
	name: string;
	contextWindow: number;
	supportsVision: boolean;
	supportsJsonMode: boolean;
	pricing: {
		input: number; // per 1M tokens
		output: number; // per 1M tokens
	};
}

/** Options for generation requests */
export interface GenerationOptions {
	apiKey: string;
	model: string;
	systemPrompt?: string;
	messages: Message[];
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	jsonMode?: boolean;
	images?: ImageData[];
	baseUrl?: string; // For OpenAI-compatible providers
}

/** Result of a generation request */
export interface GenerationResult {
	content: string;
	usage?: {
		inputTokens: number;
		outputTokens: number;
	};
	finishReason?: string;
}

/** Chunk from a streaming response */
export interface StreamChunk {
	content: string;
	isDone: boolean;
}

/** Base interface that all LLM providers must implement */
export interface LLMProvider {
	/** Unique provider identifier */
	readonly id: string;

	/** Human-readable provider name */
	readonly name: string;

	/** Whether this provider supports vision/image inputs */
	readonly supportsVision: boolean;

	/** Whether this provider supports streaming responses */
	readonly supportsStreaming: boolean;

	/**
	 * Fetch available models from the provider
	 * @param apiKey - The API key for authentication
	 */
	fetchModels(apiKey: string): Promise<ProviderModel[]>;

	/**
	 * Validate that an API key is valid and has necessary permissions
	 * @param apiKey - The API key to validate
	 */
	validateApiKey(apiKey: string): Promise<boolean>;

	/**
	 * Generate a completion
	 * @param options - Generation options
	 */
	generate(options: GenerationOptions): Promise<GenerationResult>;

	/**
	 * Generate a streaming completion (optional)
	 * @param options - Generation options
	 */
	generateStream?(options: GenerationOptions): AsyncIterable<StreamChunk>;

	/**
	 * Estimate the cost of a request
	 * @param model - Model ID
	 * @param inputTokens - Number of input tokens
	 * @param outputTokens - Number of output tokens
	 * @returns Estimated cost in USD
	 */
	estimateCost(model: string, inputTokens: number, outputTokens: number): number;
}
