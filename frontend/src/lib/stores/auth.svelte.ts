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
 */
class AuthStore {
  private _user = $state<User | null>(null);
  private _loading = $state(false);

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

  /**
   * Check if user has a specific feature enabled
   */
  hasFeature(feature: keyof UserFeatureFlags): boolean {
    return this._user?.featureFlags[feature] ?? false;
  }

  /**
   * Login with token
   */
  setToken(token: string) {
    localStorage.setItem('auth_token', token);
  }

  /**
   * Get stored token
   */
  getToken() {
    return localStorage.getItem('auth_token');
  }

  /**
   * Set user data
   */
  setUser(user: User) {
    this._user = user;
  }

  /**
   * Load current user from API
   */
  async loadUser() {
    const token = this.getToken();
    if (!token) {
      this._user = null;
      return;
    }

    this._loading = true;
    try {
      const user = await trpc.auth.me.query();
      this._user = user;
    } catch (error) {
      // Token invalid, clear it
      this.logout();
    } finally {
      this._loading = false;
    }
  }

  /**
   * Logout and clear data
   */
  logout() {
    localStorage.removeItem('auth_token');
    this._user = null;
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}

export const authStore = new AuthStore();
