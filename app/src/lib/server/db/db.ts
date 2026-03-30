import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { env } from '$env/dynamic/private';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let poolInstance: Pool | null = null;

function getDatabaseUrl(): string {
  // Try dynamic env first (SvelteKit runtime), then process.env (fallback)
  const url = env?.DATABASE_URL || process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return url;
}

function getPool(): Pool {
  if (poolInstance) return poolInstance;

  const connectionString = getDatabaseUrl();

  poolInstance = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  poolInstance.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  return poolInstance;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

// Export schema for type usage
export { schema };

// Backwards compatible export - lazy init
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop) {
    return getDb()[prop as keyof typeof target];
  },
});

// Graceful shutdown helper
export async function closePool() {
  if (poolInstance) {
    await poolInstance.end();
  }
}
