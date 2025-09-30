import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../../backend/src/trpc/router';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Create tRPC client with authentication
 */
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers() {
        const token = localStorage.getItem('auth_token');
        return token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {};
      },
    }),
  ],
});
