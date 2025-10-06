import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context.js';
import { generateToken } from '../../utils/auth.js';

const t = initTRPC.context<Context>().create();

// Fixed user ID for single-user mode
const ADMIN_USER_ID = 'admin-user';

// Get credentials from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

export const authRouter = t.router({
  /**
   * Login with hardcoded credentials from environment variables
   * Single-user authentication - no registration needed
   */
  login: t.procedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Check credentials against environment variables
      if (input.username !== ADMIN_USERNAME || input.password !== ADMIN_PASSWORD) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        });
      }

      // Generate token for the fixed admin user
      const token = await generateToken(ADMIN_USER_ID);

      return {
        token,
        user: {
          id: ADMIN_USER_ID,
          username: ADMIN_USERNAME,
        },
      };
    }),

  /**
   * Get current user from token (returns fixed admin user)
   */
  me: t.procedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    // Return fixed admin user info
    return {
      id: ADMIN_USER_ID,
      username: ADMIN_USERNAME,
    };
  }),
});
