import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import crypto from 'crypto';
import { verifyToken } from '../utils/auth.js';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';

/**
 * Context for tRPC - includes authenticated user if token is valid
 */
export interface Context {
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  res?: CreateExpressContextOptions['res'];
}

/**
 * Hash a token for secure storage comparison
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create context for each request
 * Extracts and verifies JWT from HTTP-only cookie or Authorization header (fallback)
 */
export async function createContext({
  req,
  res,
}: CreateExpressContextOptions): Promise<Context> {
  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0];

  const baseContext: Context = {
    userAgent,
    ipAddress,
    res,
  };

  // Try to get token from HTTP-only cookie first, then Authorization header as fallback
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return baseContext;
  }

  try {
    const { userId } = await verifyToken(token);

    // Hash the token to compare with stored hash
    const tokenHash = hashToken(token);

    // Validate session exists and is not expired (compare hashed token)
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date())
      ),
    });

    if (!session) {
      // Token is valid JWT but session was revoked or expired
      return baseContext;
    }

    // Update last active time
    await db.update(sessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(sessions.id, session.id));

    return { ...baseContext, userId, sessionId: session.id };
  } catch (error) {
    // Invalid token - return empty context
    return baseContext;
  }
}
