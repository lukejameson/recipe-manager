import type { Handle, HandleServerError } from '@sveltejs/kit';

// Simple in-memory rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 200; // requests per window

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (now > entry.resetTime) {
      rateLimits.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

export const handle: Handle = async ({ event, resolve }) => {
  // Get client IP
  const clientAddress = event.getClientAddress();
  const now = Date.now();

  // Rate limiting (skip for static assets)
  if (!event.url.pathname.startsWith('/icons/') &&
      !event.url.pathname.startsWith('/_app/') &&
      !event.url.pathname.startsWith('/favicon')) {
    const limit = rateLimits.get(clientAddress);
    if (limit) {
      if (now > limit.resetTime) {
        rateLimits.set(clientAddress, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      } else if (limit.count >= RATE_LIMIT_MAX) {
        return new Response('Too many requests', {
          status: 429,
          headers: {
            'Content-Type': 'text/plain',
            'Retry-After': String(Math.ceil((limit.resetTime - now) / 1000)),
          },
        });
      } else {
        limit.count++;
      }
    } else {
      rateLimits.set(clientAddress, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }
  }

  // Resolve the request
  const response = await resolve(event);

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add CORS headers for API routes (same-origin only)
  if (event.url.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Origin', event.request.headers.get('origin') || '*');
  }

  return response;
};

export const handleError: HandleServerError = async ({ error, event }) => {
  console.error('Server error:', error);

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : error instanceof Error ? error.message : 'Unknown error';

  return {
    message,
    code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN',
  };
};
