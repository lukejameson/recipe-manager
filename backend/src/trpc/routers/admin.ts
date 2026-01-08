import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { eq, desc, isNull, sql, type SQL } from 'drizzle-orm';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { users, inviteCodes, auditLogs, DEFAULT_FEATURE_FLAGS, type UserFeatureFlags } from '../../db/schema.js';
import { createAuditLog } from '../../utils/auditLog.js';

const t = initTRPC.context<Context>().create();

/**
 * Middleware to ensure user is authenticated
 */
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/**
 * Middleware to ensure user is an admin
 */
const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, ctx.userId),
  });

  if (!user || !user.isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({ ctx: { ...ctx, userId: ctx.userId, isAdmin: true } });
});

const adminProcedure = t.procedure.use(isAdmin);

/**
 * Generate a random invite code (8 characters, alphanumeric)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const adminRouter = t.router({
  /**
   * List all users
   */
  listUsers: adminProcedure.query(async () => {
    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
    });

    return allUsers.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
      featureFlags: user.featureFlags ?? DEFAULT_FEATURE_FLAGS,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    }));
  }),

  /**
   * Get a single user by ID
   */
  getUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        isAdmin: user.isAdmin,
        featureFlags: user.featureFlags ?? DEFAULT_FEATURE_FLAGS,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      };
    }),

  /**
   * Update a user's feature flags
   */
  updateUserFeatures: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        featureFlags: z.object({
          aiChat: z.boolean(),
          recipeGeneration: z.boolean(),
          tagSuggestions: z.boolean(),
          nutritionCalc: z.boolean(),
          photoExtraction: z.boolean(),
          urlImport: z.boolean(),
          imageSearch: z.boolean(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const oldFlags = user.featureFlags ?? DEFAULT_FEATURE_FLAGS;

      await db.update(users)
        .set({ featureFlags: input.featureFlags })
        .where(eq(users.id, input.userId));

      await createAuditLog({
        userId: ctx.userId,
        action: 'admin.user_features_updated',
        targetType: 'user',
        targetId: input.userId,
        details: {
          username: user.username,
          oldFlags,
          newFlags: input.featureFlags,
        },
        ipAddress: ctx.ipAddress,
      });

      return { success: true };
    }),

  /**
   * Toggle admin status for a user
   * Cannot demote yourself
   */
  toggleAdmin: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        isAdmin: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent self-demotion
      if (ctx.userId === input.userId && !input.isAdmin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot remove your own admin privileges',
        });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      await db.update(users)
        .set({ isAdmin: input.isAdmin })
        .where(eq(users.id, input.userId));

      await createAuditLog({
        userId: ctx.userId,
        action: 'admin.user_admin_toggled',
        targetType: 'user',
        targetId: input.userId,
        details: {
          username: user.username,
          wasAdmin: user.isAdmin,
          isAdmin: input.isAdmin,
        },
        ipAddress: ctx.ipAddress,
      });

      return { success: true };
    }),

  /**
   * Update user profile (email, display name)
   */
  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        email: z.string().email().nullable().optional(),
        displayName: z.string().max(100).nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const updates: Partial<{ email: string | null; displayName: string | null }> = {};
      if (input.email !== undefined) updates.email = input.email;
      if (input.displayName !== undefined) updates.displayName = input.displayName;

      if (Object.keys(updates).length > 0) {
        await db.update(users)
          .set(updates)
          .where(eq(users.id, input.userId));
      }

      return { success: true };
    }),

  /**
   * Delete a user and all their data
   * Cannot delete yourself
   */
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent self-deletion
      if (ctx.userId === input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete your own account',
        });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      await createAuditLog({
        userId: ctx.userId,
        action: 'admin.user_deleted',
        targetType: 'user',
        targetId: input.userId,
        details: {
          username: user.username,
          email: user.email,
          wasAdmin: user.isAdmin,
        },
        ipAddress: ctx.ipAddress,
      });

      // Delete user (cascades to all user data due to FK constraints)
      await db.delete(users).where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Create a new invite code
   */
  createInviteCode: adminProcedure
    .input(
      z.object({
        expiresInDays: z.number().min(1).max(365).optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      let code: string;
      let attempts = 0;

      // Generate unique code (retry if collision)
      do {
        code = generateInviteCode();
        const existing = await db.query.inviteCodes.findFirst({
          where: eq(inviteCodes.code, code),
        });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate unique invite code',
        });
      }

      const expiresAt = input?.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const id = crypto.randomUUID();
      await db.insert(inviteCodes).values({
        id,
        code,
        createdBy: ctx.userId,
        expiresAt,
        createdAt: new Date(),
      });

      await createAuditLog({
        userId: ctx.userId,
        action: 'admin.invite_created',
        targetType: 'invite_code',
        targetId: id,
        details: {
          code,
          expiresAt,
          expiresInDays: input?.expiresInDays,
        },
        ipAddress: ctx.ipAddress,
      });

      return {
        id,
        code,
        expiresAt,
      };
    }),

  /**
   * List all invite codes
   */
  listInviteCodes: adminProcedure.query(async () => {
    const codes = await db.query.inviteCodes.findMany({
      orderBy: [desc(inviteCodes.createdAt)],
    });

    // Get user info for created_by and used_by
    const userIds = [...new Set([
      ...codes.map(c => c.createdBy),
      ...codes.filter(c => c.usedBy).map(c => c.usedBy!),
    ])];

    const usersData = await db.query.users.findMany({
      where: (users, { inArray }) => inArray(users.id, userIds),
    });

    const userMap = new Map(usersData.map(u => [u.id, u.username]));

    return codes.map(code => ({
      id: code.id,
      code: code.code,
      createdBy: code.createdBy,
      createdByUsername: userMap.get(code.createdBy) ?? 'Unknown',
      usedBy: code.usedBy,
      usedByUsername: code.usedBy ? userMap.get(code.usedBy) ?? 'Unknown' : null,
      usedAt: code.usedAt,
      expiresAt: code.expiresAt,
      createdAt: code.createdAt,
      isUsed: code.usedBy !== null,
      isExpired: code.expiresAt ? code.expiresAt < new Date() : false,
    }));
  }),

  /**
   * Delete an unused invite code
   */
  deleteInviteCode: adminProcedure
    .input(z.object({ codeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const code = await db.query.inviteCodes.findFirst({
        where: eq(inviteCodes.id, input.codeId),
      });

      if (!code) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invite code not found',
        });
      }

      if (code.usedBy) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete a used invite code',
        });
      }

      await createAuditLog({
        userId: ctx.userId,
        action: 'admin.invite_deleted',
        targetType: 'invite_code',
        targetId: input.codeId,
        details: {
          code: code.code,
        },
        ipAddress: ctx.ipAddress,
      });

      await db.delete(inviteCodes).where(eq(inviteCodes.id, input.codeId));

      return { success: true };
    }),

  /**
   * List audit logs with pagination
   */
  listAuditLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        action: z.string().optional(),
        userId: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      // Build where conditions
      const conditions: SQL[] = [];
      if (input?.action) {
        conditions.push(eq(auditLogs.action, input.action));
      }
      if (input?.userId) {
        conditions.push(eq(auditLogs.userId, input.userId));
      }

      const logs = await db.query.auditLogs.findMany({
        where: conditions.length > 0 ? (auditLogs, { and }) => and(...conditions) : undefined,
        orderBy: [desc(auditLogs.createdAt)],
        limit,
        offset,
      });

      // Get user info for display
      const userIds = [...new Set(logs.map(l => l.userId).filter((id): id is string => id !== null))];
      const usersData = userIds.length > 0
        ? await db.query.users.findMany({
            where: (users, { inArray }) => inArray(users.id, userIds),
          })
        : [];

      const userMap = new Map(usersData.map(u => [u.id, u.username]));

      // Get total count
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);
      const total = countResult[0]?.count ?? 0;

      return {
        logs: logs.map(log => ({
          id: log.id,
          userId: log.userId,
          username: log.userId ? userMap.get(log.userId) ?? 'Unknown' : 'System',
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          details: log.details,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
        })),
        total,
        limit,
        offset,
      };
    }),

  /**
   * Get distinct audit log actions for filtering
   */
  getAuditLogActions: adminProcedure.query(async () => {
    const result = await db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(auditLogs.action);

    return result.map(r => r.action);
  }),
});
