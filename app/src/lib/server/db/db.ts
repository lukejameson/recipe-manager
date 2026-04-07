import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { env } from '$env/dynamic/private';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../../.env');

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex);
        const value = trimmed.slice(eqIndex + 1);
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let poolInstance: Pool | null = null;

function getDatabaseUrl(): string {
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

export { schema };

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop) {
    return getDb()[prop as keyof typeof target];
  },
});

export async function closePool() {
  if (poolInstance) {
    await poolInstance.end();
  }
}
