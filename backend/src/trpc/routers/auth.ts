import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { eq, and, isNull, desc, ne } from 'drizzle-orm';
import crypto from 'crypto';
import { Context, hashToken } from '../context.js';
import { generateToken, hashPassword, verifyPassword } from '../../utils/auth.js';
import { createAuditLog } from '../../utils/auditLog.js';
import { db } from '../../db/index.js';
import {
  users,
  inviteCodes,
  sessions,
  recipes,
  tags,
  collections,
  shoppingListItems,
  memories,
  agents,
  DEFAULT_FEATURE_FLAGS,
  type UserFeatureFlags,
} from '../../db/schema.js';

const t = initTRPC.context<Context>().create();

// Admin user ID for the system admin
const ADMIN_USER_ID = 'admin-user';

// Account lockout settings
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const SESSION_DURATION_DAYS = 30;

// Cookie settings
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction, // Only send over HTTPS in production
  sameSite: 'lax' as const, // CSRF protection
  maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000, // 30 days in ms
  path: '/',
};

/**
 * Generate a cryptographically secure invite code (12 characters)
 */
function generateInviteCode(): string {
  // Use crypto.randomBytes for cryptographically secure random values
  const bytes = crypto.randomBytes(9); // 9 bytes = 12 base64url chars
  return bytes.toString('base64url').substring(0, 12).toUpperCase();
}

/**
 * Create a session for a user (stores hashed token)
 */
async function createSession(
  userId: string,
  token: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  // Store hashed token for security
  const tokenHash = hashToken(token);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    userAgent,
    ipAddress,
    expiresAt,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  });
}

/**
 * Set auth cookie on response
 */
function setAuthCookie(ctx: Context, token: string): void {
  if (ctx.res) {
    ctx.res.cookie('auth_token', token, COOKIE_OPTIONS);
  }
}

/**
 * Clear auth cookie on response
 */
function clearAuthCookie(ctx: Context): void {
  if (ctx.res) {
    ctx.res.clearCookie('auth_token', { path: '/' });
  }
}

export const authRouter = t.router({
  /**
   * Login with database-backed credentials
   */
  login: t.procedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find user by username
      const user = await db.query.users.findFirst({
        where: eq(users.username, input.username),
      });

      if (!user) {
        await createAuditLog({
          action: 'user.login_failed',
          details: { username: input.username, reason: 'user_not_found' },
          ipAddress: ctx.ipAddress,
        });
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        });
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingMinutes = Math.ceil(
          (user.lockedUntil.getTime() - Date.now()) / (1000 * 60)
        );
        await createAuditLog({
          userId: user.id,
          action: 'user.login_failed',
          targetType: 'user',
          targetId: user.id,
          details: { reason: 'account_locked', remainingMinutes },
          ipAddress: ctx.ipAddress,
        });
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Account is locked. Please try again in ${remainingMinutes} minute(s).`,
        });
      }

      // Verify password
      const validPassword = await verifyPassword(input.password, user.passwordHash);
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

        await createAuditLog({
          userId: user.id,
          action: 'user.login_failed',
          targetType: 'user',
          targetId: user.id,
          details: {
            reason: 'invalid_password',
            failedAttempts: newFailedAttempts,
            accountLocked: newFailedAttempts >= MAX_FAILED_ATTEMPTS,
          },
          ipAddress: ctx.ipAddress,
        });

        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
          });
        }

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        });
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
      const token = await generateToken(user.id);
      await createSession(user.id, token, ctx.userAgent, ctx.ipAddress);

      // Set HTTP-only cookie
      setAuthCookie(ctx, token);

      await createAuditLog({
        userId: user.id,
        action: 'user.login',
        targetType: 'user',
        targetId: user.id,
        ipAddress: ctx.ipAddress,
      });

      // Get effective feature flags (user flags or defaults)
      const featureFlags = user.featureFlags ?? DEFAULT_FEATURE_FLAGS;

      return {
        user: {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
          email: user.email,
          displayName: user.displayName,
          featureFlags,
        },
      };
    }),

  /**
   * Register a new user with an invite code
   */
  register: t.procedure
    .input(
      z.object({
        username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/,
          'Username can only contain letters, numbers, underscores, and hyphens'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        inviteCode: z.string().length(12),
        email: z.string().email().optional(),
        displayName: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate invite code
      const code = await db.query.inviteCodes.findFirst({
        where: and(
          eq(inviteCodes.code, input.inviteCode.toUpperCase()),
          isNull(inviteCodes.usedBy),
        ),
      });

      if (!code) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or already used invite code',
        });
      }

      // Check if code is expired
      if (code.expiresAt && code.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invite code has expired',
        });
      }

      // Check if username is taken
      const existingUser = await db.query.users.findFirst({
        where: eq(users.username, input.username),
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Username is already taken',
        });
      }

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Create user
      const userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        username: input.username,
        passwordHash,
        email: input.email,
        displayName: input.displayName,
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
      await createSession(userId, token, ctx.userAgent, ctx.ipAddress);

      // Set HTTP-only cookie
      setAuthCookie(ctx, token);

      await createAuditLog({
        userId,
        action: 'user.register',
        targetType: 'user',
        targetId: userId,
        details: { inviteCodeId: code.id },
        ipAddress: ctx.ipAddress,
      });

      return {
        user: {
          id: userId,
          username: input.username,
          isAdmin: false,
          email: input.email ?? null,
          displayName: input.displayName ?? null,
          featureFlags: DEFAULT_FEATURE_FLAGS,
        },
      };
    }),

  /**
   * Get current user from token
   */
  me: t.procedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
    });

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not found',
      });
    }

    // Get effective feature flags
    const featureFlags = user.featureFlags ?? DEFAULT_FEATURE_FLAGS;

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      email: user.email,
      displayName: user.displayName,
      featureFlags,
    };
  }),

  /**
   * Change password for the current user
   */
  changePassword: t.procedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8, 'Password must be at least 8 characters'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not found',
        });
      }

      // Verify current password
      const validPassword = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!validPassword) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Current password is incorrect',
        });
      }

      // Hash new password and update
      const passwordHash = await hashPassword(input.newPassword);
      await db.update(users)
        .set({ passwordHash })
        .where(eq(users.id, ctx.userId));

      await createAuditLog({
        userId: ctx.userId,
        action: 'user.password_changed',
        targetType: 'user',
        targetId: ctx.userId,
        ipAddress: ctx.ipAddress,
      });

      return { success: true };
    }),

  /**
   * Update profile (email, display name)
   */
  updateProfile: t.procedure
    .input(
      z.object({
        email: z.string().email().nullable().optional(),
        displayName: z.string().max(100).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }

      await db.update(users)
        .set({
          email: input.email,
          displayName: input.displayName,
        })
        .where(eq(users.id, ctx.userId));

      return { success: true };
    }),

  /**
   * Delete own account (non-admin users only, or admin if they're the only admin)
   */
  deleteAccount: t.procedure
    .input(
      z.object({
        password: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not found',
        });
      }

      // Verify password
      const validPassword = await verifyPassword(input.password, user.passwordHash);
      if (!validPassword) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Password is incorrect',
        });
      }

      // Cannot delete the main admin account
      if (ctx.userId === ADMIN_USER_ID) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot delete the primary admin account',
        });
      }

      await createAuditLog({
        userId: ctx.userId,
        action: 'user.deleted',
        targetType: 'user',
        targetId: ctx.userId,
        details: { username: user.username, selfDelete: true },
        ipAddress: ctx.ipAddress,
      });

      // Delete user (cascades to related data)
      await db.delete(users).where(eq(users.id, ctx.userId));

      return { success: true };
    }),

  /**
   * Logout - invalidate current session and clear cookie
   */
  logout: t.procedure.mutation(async ({ ctx }) => {
    // Clear the auth cookie
    clearAuthCookie(ctx);

    if (!ctx.userId || !ctx.sessionId) {
      return { success: true };
    }

    await db.delete(sessions).where(eq(sessions.id, ctx.sessionId));

    await createAuditLog({
      userId: ctx.userId,
      action: 'user.logout',
      targetType: 'session',
      targetId: ctx.sessionId,
      ipAddress: ctx.ipAddress,
    });

    return { success: true };
  }),

  /**
   * List all active sessions for current user
   */
  listSessions: t.procedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    const userSessions = await db.query.sessions.findMany({
      where: eq(sessions.userId, ctx.userId),
      orderBy: [desc(sessions.lastActiveAt)],
    });

    return userSessions.map(session => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === ctx.sessionId,
    }));
  }),

  /**
   * Revoke a specific session
   */
  revokeSession: t.procedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }

      // Verify session belongs to user
      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.id, input.sessionId),
          eq(sessions.userId, ctx.userId)
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      await db.delete(sessions).where(eq(sessions.id, input.sessionId));

      return { success: true };
    }),

  /**
   * Revoke all sessions except current
   */
  revokeAllOtherSessions: t.procedure.mutation(async ({ ctx }) => {
    if (!ctx.userId || !ctx.sessionId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    await db.delete(sessions).where(
      and(
        eq(sessions.userId, ctx.userId),
        ne(sessions.id, ctx.sessionId)
      )
    );

    return { success: true };
  }),
});
