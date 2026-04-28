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
	readonly id: string;
	readonly name: string;
	readonly supportsVision: boolean;
	readonly supportsStreaming: boolean;
	fetchModels(apiKey: string): Promise<ProviderModel[]>;
	validateApiKey(apiKey: string): Promise<boolean>;
	generate(options: GenerationOptions): Promise<GenerationResult>;
	generateStream?(options: GenerationOptions): AsyncIterable<StreamChunk>;
	estimateCost(model: string, inputTokens: number, outputTokens: number): number;
}

export interface ImageGenerationOptions {
	apiKey: string;
	model: string;
	prompt: string;
	aspectRatio?: '1:1' | '4:3' | '16:9';
	baseUrl?: string;
}

export interface ImageGenerationResult {
	imageData: string;
	mimeType: string;
	width?: number;
	height?: number;
	finishReason?: string;
}

export interface ImageProvider {
	readonly id: string;
	readonly name: string;
	generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
	validateApiKey(apiKey: string): Promise<boolean>;
	fetchModels?(apiKey: string): Promise<ProviderModel[]>;
}
