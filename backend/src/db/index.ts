import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

// Get database URL from environment or use default
const dbUrl = process.env.DATABASE_URL || './data/recipes.db';

// Ensure data directory exists
await mkdir(dirname(dbUrl), { recursive: true });

// Create SQLite database connection
const sqlite = new Database(dbUrl);

// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

export { schema };
