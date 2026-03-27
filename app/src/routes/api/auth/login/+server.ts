import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users, inviteCodes, sessions, DEFAULT_FEATURE_FLAGS } from '$lib/server/db/schema';
import { verifyPassword, generateToken, createSession, setAuthCookie, hashToken } from '$lib/server/auth';
import { eq, and, isNull } from 'drizzle-orm';

// Account lockout settings
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  try {
    const { username, password, rememberMe } = await request.json();

    if (!username || !password) {
      throw error(400, 'Username and password required');
    }

    // Find user by username
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      throw error(401, 'Invalid username or password');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (1000 * 60)
      );
      throw error(403, `Account is locked. Please try again in ${remainingMinutes} minute(s).`);
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      // Increment failed attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: newFailedAttempts,
      };

      // Lock account if max attempts reached
      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
        updateData.lockedUntil = lockUntil;
      }

      await db.update(users)
        .set(updateData)
        .where(eq(users.id, user.id));

      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw error(403, `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`);
      }

      throw error(401, 'Invalid username or password');
    }

    // Successful login - reset failed attempts and update last login
    await db.update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Generate token and create session
    const token = await generateToken(user.id, rememberMe ? 90 : 1);
    await createSession(user.id, token, request.headers.get('user-agent') || undefined, getClientAddress(), rememberMe);

    // Set HTTP-only cookie with appropriate duration
    setAuthCookie(cookies, token, rememberMe);

    // Get effective feature flags
    const featureFlags = user.featureFlags ?? DEFAULT_FEATURE_FLAGS;

    return json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        email: user.email,
        displayName: user.displayName,
        featureFlags,
      },
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Login error:', e);
    throw error(500, 'Internal server error');
  }
};
