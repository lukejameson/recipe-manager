interface CachedEntry<T> {
  data: T;
  expiresAt: number;
}

export class PhotoCache {
  private cache = new Map<string, CachedEntry<any>>();
  private readonly ttl: number;

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) {
    this.ttl = ttlMs;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  get<T>(recipeId: string): T | null {
    this.cleanup();
    const entry = this.cache.get(recipeId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(recipeId);
      return null;
    }
    return entry.data as T;
  }

  set<T>(recipeId: string, data: T): void {
    this.cache.set(recipeId, {
      data,
      expiresAt: Date.now() + this.ttl,
    });
  }

  invalidate(recipeId: string): void {
    this.cache.delete(recipeId);
  }

  invalidateMultiple(recipeIds: string[]): void {
    for (const id of recipeIds) {
      this.cache.delete(id);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const photoCache = new PhotoCache();
