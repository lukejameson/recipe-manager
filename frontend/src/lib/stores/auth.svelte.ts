import { trpc } from '$lib/trpc/client';

/**
 * Auth store using Svelte 5 Runes
 */
class AuthStore {
  private _user = $state<{ id: string; username: string } | null>(null);
  private _loading = $state(false);

  get user() {
    return this._user;
  }

  get isAuthenticated() {
    return this._user !== null;
  }

  get loading() {
    return this._loading;
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
  setUser(user: { id: string; username: string }) {
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
