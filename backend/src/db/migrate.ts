import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, closePool } from './index.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run migrations
try {
  await migrate(db, { migrationsFolder: `${__dirname}/migrations-pg` });
  console.log('✅ Database migrations completed successfully');
} finally {
  await closePool();
}
