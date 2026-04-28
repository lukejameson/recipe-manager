export class AIConfigurationError extends Error {
	constructor(message = 'AI service not configured. Please add API keys in Settings.') {
		super(message);
		this.name = 'AIConfigurationError';
	}
}

export function isAIConfigurationError(error: unknown): boolean {
	return error instanceof AIConfigurationError;
}

export class AIRateLimitError extends Error {
	retryAfter?: number;
	constructor(message = 'AI service is temporarily busy. Please try again in a moment.', retryAfter?: number) {
		super(message);
		this.name = 'AIRateLimitError';
		this.retryAfter = retryAfter;
	}
}

export function isAIRateLimitError(error: unknown): boolean {
	return error instanceof AIRateLimitError;
}

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
