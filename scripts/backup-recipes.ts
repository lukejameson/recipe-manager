import { db } from '../app/src/lib/server/db/index.js';
import { recipes } from '../app/src/lib/server/db/schema.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function backupRecipes() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Ensure backups directory exists
  const backupsDir = join(process.cwd(), 'backups');
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  const backupPath = join(backupsDir, `recipes-${timestamp}.json`);

  const allRecipes = await db.select().from(recipes);

  const backup = {
    timestamp: new Date().toISOString(),
    count: allRecipes.length,
    recipes: allRecipes
  };

  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`✅ Backed up ${allRecipes.length} recipes to ${backupPath}`);
}

backupRecipes().catch(console.error);
