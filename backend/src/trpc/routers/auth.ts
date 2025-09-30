import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { hashPassword, verifyPassword, generateToken } from '../../utils/auth.js';
import { eq } from 'drizzle-orm';

const t = initTRPC.context<Context>().create();

export const authRouter = t.router({
  /**
   * Register a new user (only if no users exist)
   */
  register: t.procedure
    .input(
      z.object({
        username: z.string().min(3).max(50),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      // Check if any users exist
      const existingUsers = await db.select().from(users).limit(1);

      if (existingUsers.length > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'User registration is disabled - a user already exists',
        });
      }

      // Check if username is taken (shouldn't be possible but just in case)
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (existingUser.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Username already exists',
        });
      }

      // Hash password and create user
      const passwordHash = await hashPassword(input.password);

      const [newUser] = await db
        .insert(users)
        .values({
          username: input.username,
          passwordHash,
        })
        .returning();

      // Generate token
      const token = await generateToken(newUser.id);

      return {
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
        },
      };
    }),

  /**
   * Login with username and password
   */
  login: t.procedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Find user by username
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        });
      }

      // Verify password
      const isValid = await verifyPassword(input.password, user.passwordHash);

      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        });
      }

      // Generate token
      const token = await generateToken(user.id);

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
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

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return {
      id: user.id,
      username: user.username,
    };
  }),
});
