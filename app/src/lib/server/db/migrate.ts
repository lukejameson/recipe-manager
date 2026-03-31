import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 1,
});
const db = drizzle(pool, { schema });
const migrationsFolder = resolve(__dirname, '../../../../drizzle');
try {
  await migrate(db, { migrationsFolder });
  console.log('✅ Database migrations completed successfully');
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
