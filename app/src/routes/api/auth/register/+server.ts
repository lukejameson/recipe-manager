import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { users, inviteCodes, DEFAULT_FEATURE_FLAGS } from '$lib/server/db/schema';
import { hashPassword, generateToken, createSession, setAuthCookie } from '$lib/server/auth';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  try {
    const { username, password, inviteCode, email, displayName } = await request.json();

    if (!username || !password || !inviteCode) {
      throw error(400, 'Username, password, and invite code required');
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw error(400, 'Username can only contain letters, numbers, underscores, and hyphens');
    }

    if (username.length < 3 || username.length > 50) {
      throw error(400, 'Username must be between 3 and 50 characters');
    }

    if (password.length < 8) {
      throw error(400, 'Password must be at least 8 characters');
    }

    // Validate invite code
    const code = await db.query.inviteCodes.findFirst({
      where: and(
        eq(inviteCodes.code, inviteCode.toUpperCase()),
        isNull(inviteCodes.usedBy),
      ),
    });

    if (!code) {
      throw error(400, 'Invalid or already used invite code');
    }

    // Check if code is expired
    if (code.expiresAt && code.expiresAt < new Date()) {
      throw error(400, 'Invite code has expired');
    }

    // Check if username is taken
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser) {
      throw error(409, 'Username is already taken');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      username,
      passwordHash,
      email: email || null,
      displayName: displayName || null,
      isAdmin: false,
      featureFlags: DEFAULT_FEATURE_FLAGS,
      createdAt: new Date(),
    });

    // Mark invite code as used
    await db.update(inviteCodes)
      .set({
        usedBy: userId,
        usedAt: new Date(),
      })
      .where(eq(inviteCodes.id, code.id));

    // Generate token and create session
    const token = await generateToken(userId);
    await createSession(userId, token, request.headers.get('user-agent') || undefined, getClientAddress());

    // Set HTTP-only cookie
    setAuthCookie(cookies, token);

    return json({
      success: true,
      user: {
        id: userId,
        username,
        isAdmin: false,
        email: email ?? null,
        displayName: displayName ?? null,
        featureFlags: DEFAULT_FEATURE_FLAGS,
      },
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Registration error:', e);
    throw error(500, 'Internal server error');
  }
};
