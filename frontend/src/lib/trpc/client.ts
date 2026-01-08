import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../../backend/src/trpc/router';

// Use relative URL in production (same domain via Traefik), absolute URL in development
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Create tRPC client with cookie-based authentication
 *
 * Credentials are sent via HTTP-only cookies, which the browser
 * automatically includes with requests when credentials: 'include' is set.
 */
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include', // Include cookies with requests
        });
      },
    }),
  ],
});
