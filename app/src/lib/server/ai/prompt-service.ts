import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/db.js';
import { featurePrompts, featurePromptHistory, users } from '../db/schema.js';
import { AIFeature } from './features.js';
import { DEFAULT_PROMPTS, getDefaultPrompt, type DefaultPrompt } from './default-prompts.js';
import type { FeaturePrompt, FeaturePromptHistoryEntry } from '../db/schema.js';

export interface PromptWithVariables {
	featureId: string;
	content: string;
	version: number;
	updatedAt: Date | null;
	updatedBy: string | null;
	updatedByUsername: string | null;
	variables: Array<{
		name: string;
		description: string;
		sampleValue: string;
	}>;
	isDefault: boolean;
}

export interface PromptHistoryItem {
	id: string;
	content: string;
	version: number;
	changedBy: string | null;
	changedByUsername: string | null;
	changedAt: Date;
}

export class PromptService {
	static async getPrompt(featureId: AIFeature): Promise<PromptWithVariables | null> {
		const prompt = await db.query.featurePrompts?.findFirst({
			where: eq(featurePrompts.featureId, featureId)
		});

		const defaultPrompt = getDefaultPrompt(featureId);

		if (!prompt) {
			if (defaultPrompt) {
				return {
					featureId,
					content: defaultPrompt.content,
					version: 0,
					updatedAt: null,
					updatedBy: null,
					updatedByUsername: null,
					variables: defaultPrompt.variables,
					isDefault: true
				};
			}
			return null;
		}

		const variables = defaultPrompt?.variables || [];

		let updatedByUsername: string | null = null;
		if (prompt.updatedBy) {
			const user = await db.query.users?.findFirst({
				where: eq(users.id, prompt.updatedBy)
			});
			updatedByUsername = user?.username || null;
		}

		return {
			featureId: prompt.featureId as AIFeature,
			content: prompt.content,
			version: prompt.version,
			updatedAt: prompt.updatedAt,
			updatedBy: prompt.updatedBy,
			updatedByUsername,
			variables,
			isDefault: false
		};
	}

	static async getAllPrompts(): Promise<PromptWithVariables[]> {
		const prompts = await db.query.featurePrompts?.findMany({
			orderBy: desc(featurePrompts.featureId)
		});

		const results: PromptWithVariables[] = [];

		for (const prompt of prompts || []) {
			const defaultPrompt = getDefaultPrompt(prompt.featureId as AIFeature);
			const variables = defaultPrompt?.variables || [];

			let updatedByUsername: string | null = null;
			if (prompt.updatedBy) {
				const user = await db.query.users?.findFirst({
					where: eq(users.id, prompt.updatedBy)
				});
				updatedByUsername = user?.username || null;
			}

			results.push({
				featureId: prompt.featureId as AIFeature,
				content: prompt.content,
				version: prompt.version,
				updatedAt: prompt.updatedAt,
				updatedBy: prompt.updatedBy,
				updatedByUsername,
				variables,
				isDefault: false
			});
		}

		for (const featureId of Object.values(AIFeature)) {
			if (!results.some(p => p.featureId === featureId)) {
				const defaultPrompt = getDefaultPrompt(featureId);
				if (defaultPrompt) {
					results.push({
						featureId,
						content: defaultPrompt.content,
						version: 0,
						updatedAt: null,
						updatedBy: null,
						updatedByUsername: null,
						variables: defaultPrompt.variables,
						isDefault: true
					});
				}
			}
		}

		return results.sort((a, b) => a.featureId.localeCompare(b.featureId));
	}

	static async updatePrompt(
		featureId: AIFeature,
		content: string,
		userId: string
	): Promise<FeaturePrompt> {
		const existing = await db.query.featurePrompts?.findFirst({
			where: eq(featurePrompts.featureId, featureId)
		});

		if (existing) {
			const newVersion = existing.version + 1;

			await db.insert(featurePromptHistory).values({
				id: crypto.randomUUID(),
				promptId: existing.id,
				content: existing.content,
				version: existing.version,
				changedBy: existing.updatedBy,
				changedAt: existing.updatedAt || new Date()
			});

			await db
				.update(featurePrompts)
				.set({
					content,
					version: newVersion,
					updatedAt: new Date(),
					updatedBy: userId
				})
				.where(eq(featurePrompts.id, existing.id));

			return {
				...existing,
				content,
				version: newVersion,
				updatedAt: new Date(),
				updatedBy: userId
			};
		} else {
			const id = crypto.randomUUID();
			await db.insert(featurePrompts).values({
				id,
				featureId,
				content,
				version: 1,
				createdAt: new Date(),
				updatedAt: new Date(),
				updatedBy: userId
			});

			return {
				id,
				featureId,
				content,
				version: 1,
				createdAt: new Date(),
				updatedAt: new Date(),
				updatedBy: userId
			};
		}
	}

	static async getPromptHistory(featureId: AIFeature): Promise<PromptHistoryItem[]> {
		const prompt = await db.query.featurePrompts?.findFirst({
			where: eq(featurePrompts.featureId, featureId)
		});

		if (!prompt) {
			return [];
		}

		const history = await db.query.featurePromptHistory?.findMany({
			where: eq(featurePromptHistory.promptId, prompt.id),
			orderBy: desc(featurePromptHistory.version)
		});

		const results: PromptHistoryItem[] = [];

		for (const entry of history || []) {
			let changedByUsername: string | null = null;
			if (entry.changedBy) {
				const user = await db.query.users?.findFirst({
					where: eq(users.id, entry.changedBy)
				});
				changedByUsername = user?.username || null;
			}

			results.push({
				id: entry.id,
				content: entry.content,
				version: entry.version,
				changedBy: entry.changedBy,
				changedByUsername,
				changedAt: entry.changedAt
			});
		}

		return results;
	}

	static async resetToDefault(featureId: AIFeature, userId: string): Promise<FeaturePrompt | null> {
		const defaultPrompt = getDefaultPrompt(featureId);
		if (!defaultPrompt) {
			return null;
		}

		return this.updatePrompt(featureId, defaultPrompt.content, userId);
	}

	static async searchPrompts(query: string): Promise<PromptWithVariables[]> {
		const allPrompts = await this.getAllPrompts();
		const lowerQuery = query.toLowerCase();

		return allPrompts.filter(
			p =>
				p.content.toLowerCase().includes(lowerQuery) ||
				p.featureId.toLowerCase().includes(lowerQuery)
		);
	}

	static resolvePromptVariables(
		content: string,
		variables: Record<string, string>
	): string {
		let resolved = content;
		for (const [key, value] of Object.entries(variables)) {
			const placeholder = `{{${key}}}`;
			resolved = resolved.split(placeholder).join(value);
		}
		return resolved;
	}

	static extractVariables(content: string): string[] {
		const regex = /\{\{(\w+)\}\}/g;
		const matches = content.match(regex) || [];
		return [...new Set(matches.map(m => m.slice(2, -2)))];
	}

	static async ensureDefaultPrompts(): Promise<void> {
		for (const featureId of Object.values(AIFeature)) {
			const existing = await db.query.featurePrompts?.findFirst({
				where: eq(featurePrompts.featureId, featureId)
			});

			if (!existing) {
				const defaultPrompt = getDefaultPrompt(featureId);
				if (defaultPrompt) {
					await db.insert(featurePrompts).values({
						id: crypto.randomUUID(),
						featureId,
						content: defaultPrompt.content,
						version: 1,
						createdAt: new Date(),
						updatedAt: new Date()
					});
				}
			}
		}
	}
}

export default PromptService;
