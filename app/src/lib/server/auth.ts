import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { getDb } from '$lib/server/db/db';
import { sessions, users } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

let secretKey: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (secretKey) return secretKey;
  const jwtSecret = env?.JWT_SECRET || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  secretKey = new TextEncoder().encode(jwtSecret);
  return secretKey;
}

const SHORT_SESSION_DURATION_DAYS = 1;
const LONG_SESSION_DURATION_DAYS = 90;

function isProduction(): boolean {
  return (env?.NODE_ENV || process.env.NODE_ENV) === 'production';
}

const getCookieOptions = (rememberMe: boolean) => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * (rememberMe ? LONG_SESSION_DURATION_DAYS : SHORT_SESSION_DURATION_DAYS),
  path: '/',
});

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateToken(userId: string, durationDays: number = SHORT_SESSION_DURATION_DAYS): Promise<string> {
  const token = await new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${durationDays}d`)
    .sign(getSecret());
  return token;
}

export async function verifyToken(token: string): Promise<{ userId: string }> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());
    return { userId: payload.userId as string };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export async function createSession(
  userId: string,
  token: string,
  userAgent?: string,
  ipAddress?: string,
  rememberMe: boolean = false
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (rememberMe ? LONG_SESSION_DURATION_DAYS : SHORT_SESSION_DURATION_DAYS));
  const tokenHash = hashToken(token);
  const db = getDb();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    userAgent,
    ipAddress,
    rememberMe,
    expiresAt,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  });
}

export function setAuthCookie(cookies: Cookies, token: string, rememberMe: boolean = false): void {
  cookies.set('auth_token', token, getCookieOptions(rememberMe));
}

export function clearAuthCookie(cookies: Cookies): void {
  cookies.delete('auth_token', { path: '/' });
}

interface CachedSession {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

interface CachedUser {
  userId: string;
  id: string;
  username: string;
  isAdmin: boolean;
  email: string | null;
  displayName: string | null;
  featureFlags: Record<string, boolean> | null;
  sessionId: string;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();
const userCache = new Map<string, CachedUser>();

const MAX_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function getCacheTTL(sessionExpiresAt: Date): number {
  const ttl = sessionExpiresAt.getTime() - Date.now();
  return Math.min(ttl, MAX_CACHE_TTL_MS);
}

export async function verifySession(token: string): Promise<{ userId: string; sessionId: string } | null> {
  try {
    const { userId } = await verifyToken(token);
    const tokenHash = hashToken(token);

    const cached = sessionCache.get(tokenHash);
    if (cached && cached.expiresAt > Date.now()) {
      return { userId: cached.userId, sessionId: cached.sessionId };
    }

    const db = getDb();
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date())
      ),
    });
    if (!session) {
      return null;
    }

    const ttl = getCacheTTL(session.expiresAt);
    sessionCache.set(tokenHash, {
      userId,
      sessionId: session.id,
      expiresAt: Date.now() + ttl,
    });

    await db.update(sessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(sessions.id, session.id));
    return { userId, sessionId: session.id };
  } catch {
    return null;
  }
}

export async function getCurrentUser(token: string | undefined) {
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;

  const cached = userCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      userId: cached.userId,
      id: cached.id,
      username: cached.username,
      isAdmin: cached.isAdmin,
      email: cached.email,
      displayName: cached.displayName,
      featureFlags: cached.featureFlags,
      sessionId: cached.sessionId,
    };
  }

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user) return null;

  const sessionData = sessionCache.get(hashToken(token));
  const ttl = sessionData ? sessionData.expiresAt - Date.now() : 60000;

  const result = {
    userId: user.id,
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    email: user.email,
    displayName: user.displayName,
    featureFlags: user.featureFlags,
    sessionId: session.sessionId,
  };

  userCache.set(token, {
    ...result,
    expiresAt: Date.now() + ttl,
  });

  return result;
}

export async function requireAuth(cookies: Cookies) {
  const token = cookies.get('auth_token');
  const user = await getCurrentUser(token);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
