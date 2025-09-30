import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run migrations
migrate(db, { migrationsFolder: `${__dirname}/migrations` });

console.log('✅ Database migrations completed successfully');
