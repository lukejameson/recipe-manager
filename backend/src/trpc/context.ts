import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
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
}

/**
 * Create context for each request
 * Extracts and verifies JWT from Authorization header
 */
export async function createContext({
  req,
}: CreateExpressContextOptions): Promise<Context> {
  const authHeader = req.headers.authorization;
  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0];

  const baseContext: Context = {
    userAgent,
    ipAddress,
  };

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return baseContext;
  }

  const token = authHeader.substring(7);

  try {
    const { userId } = await verifyToken(token);

    // Validate session exists and is not expired
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.token, token),
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
