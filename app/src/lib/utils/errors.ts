export class AIConfigurationError extends Error {
  constructor(message = 'AI service not configured. Please add API keys in Settings.') {
    super(message);
    this.name = 'AIConfigurationError';
  }
}

export function isAIConfigurationError(error: unknown): boolean {
  return error instanceof AIConfigurationError;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
