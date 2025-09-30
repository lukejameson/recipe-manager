import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { verifyToken } from '../utils/auth.js';

/**
 * Context for tRPC - includes authenticated user if token is valid
 */
export interface Context {
  userId?: string;
}

/**
 * Create context for each request
 * Extracts and verifies JWT from Authorization header
 */
export async function createContext({
  req,
}: CreateExpressContextOptions): Promise<Context> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {};
  }

  const token = authHeader.substring(7);

  try {
    const { userId } = await verifyToken(token);
    return { userId };
  } catch (error) {
    // Invalid token - return empty context
    return {};
  }
}
