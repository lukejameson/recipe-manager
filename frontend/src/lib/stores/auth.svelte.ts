import { trpc } from '$lib/trpc/client';

/**
 * Feature flags type - mirrors backend UserFeatureFlags
 */
export type UserFeatureFlags = {
  aiChat: boolean;
  recipeGeneration: boolean;
  tagSuggestions: boolean;
  nutritionCalc: boolean;
  photoExtraction: boolean;
  urlImport: boolean;
  imageSearch: boolean;
  jsonldImport: boolean;
};

/**
 * User type returned from auth endpoints
 */
export type User = {
  id: string;
  username: string;
  isAdmin: boolean;
  email: string | null;
  displayName: string | null;
  featureFlags: UserFeatureFlags;
};

/**
 * Auth store using Svelte 5 Runes
 *
 * Authentication is handled via HTTP-only cookies set by the server.
 * The frontend doesn't need to manage tokens directly - the browser
 * automatically sends the cookie with every request.
 */
class AuthStore {
  private _user = $state<User | null>(null);
  private _loading = $state(false);
  private _initialized = $state(false);

  get user() {
    return this._user;
  }

  get isAuthenticated() {
    return this._user !== null;
  }

  get isAdmin() {
    return this._user?.isAdmin ?? false;
  }

  get loading() {
    return this._loading;
  }

  get initialized() {
    return this._initialized;
  }

  /**
   * Check if user has a specific feature enabled
   */
  hasFeature(feature: keyof UserFeatureFlags): boolean {
    return this._user?.featureFlags[feature] ?? false;
  }

  /**
   * Set user data after login/register
   */
  setUser(user: User) {
    this._user = user;
  }

  /**
   * Load current user from API
   * Called on app initialization to check if user has valid session
   */
  async loadUser() {
    this._loading = true;
    try {
      const user = await trpc.auth.me.query();
      this._user = user;
    } catch {
      // No valid session - user not authenticated
      this._user = null;
    } finally {
      this._loading = false;
      this._initialized = true;
    }
  }

  /**
   * Logout - calls server to clear HTTP-only cookie
   */
  async logout() {
    try {
      await trpc.auth.logout.mutate();
    } catch {
      // Even if the server call fails, clear local state
    }
    this._user = null;
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}

export const authStore = new AuthStore();
