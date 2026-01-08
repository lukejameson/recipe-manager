import Database from 'better-sqlite3';
import { Pool } from 'pg';

// Configuration
const SQLITE_PATH = process.env.SQLITE_PATH || './data/recipes.db';
const PG_URL = process.env.DATABASE_URL;

if (!PG_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Convert Unix timestamp (seconds) to JavaScript Date
function unixToDate(unixTimestamp: number | null): Date | null {
  if (unixTimestamp === null || unixTimestamp === undefined) return null;
  return new Date(unixTimestamp * 1000);
}

// Parse and re-stringify JSON for PostgreSQL jsonb columns
function parseJsonForPg(jsonString: string | null): string | null {
  if (!jsonString) return null;
  try {
    // Parse and re-stringify to ensure valid JSON for PostgreSQL
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

async function migrateData() {
  console.log('Starting data migration from SQLite to PostgreSQL...\n');
  console.log(`SQLite source: ${SQLITE_PATH}`);
  console.log(`PostgreSQL target: ${PG_URL?.replace(/:[^:@]+@/, ':****@')}\n`);

  // Open SQLite connection (read-only)
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  // Open PostgreSQL connection
  const pgPool = new Pool({ connectionString: PG_URL });
  const pgClient = await pgPool.connect();

  try {
    await pgClient.query('BEGIN');

    // 1. Migrate users
    console.log('Migrating users...');
    const users = sqlite.prepare('SELECT * FROM users').all() as Array<{
      id: string;
      username: string;
      password_hash: string;
      created_at: number;
    }>;
    for (const user of users) {
      await pgClient.query(
        `INSERT INTO users (id, username, password_hash, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.username, user.password_hash, unixToDate(user.created_at)]
      );
    }
    console.log(`  Migrated ${users.length} users`);

    // 2. Migrate recipes
    console.log('Migrating recipes...');
    const recipes = sqlite.prepare('SELECT * FROM recipes').all() as Array<{
      id: string;
      title: string;
      description: string | null;
      prep_time: number | null;
      cook_time: number | null;
      total_time: number | null;
      servings: number | null;
      ingredients: string;
      instructions: string;
      image_url: string | null;
      source_url: string | null;
      is_favorite: number;
      rating: number | null;
      notes: string | null;
      difficulty: string | null;
      times_cooked: number;
      last_cooked_at: number | null;
      nutrition: string | null;
      improvement_ideas: string | null;
      created_at: number;
      updated_at: number;
    }>;
    for (const recipe of recipes) {
      await pgClient.query(
        `INSERT INTO recipes (
          id, title, description, prep_time, cook_time, total_time, servings,
          ingredients, instructions, image_url, source_url, is_favorite, rating,
          notes, difficulty, times_cooked, last_cooked_at, nutrition,
          improvement_ideas, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (id) DO NOTHING`,
        [
          recipe.id,
          recipe.title,
          recipe.description,
          recipe.prep_time,
          recipe.cook_time,
          recipe.total_time,
          recipe.servings,
          parseJsonForPg(recipe.ingredients),
          parseJsonForPg(recipe.instructions),
          recipe.image_url,
          recipe.source_url,
          Boolean(recipe.is_favorite),
          recipe.rating,
          recipe.notes,
          recipe.difficulty,
          recipe.times_cooked,
          unixToDate(recipe.last_cooked_at),
          parseJsonForPg(recipe.nutrition),
          parseJsonForPg(recipe.improvement_ideas),
          unixToDate(recipe.created_at),
          unixToDate(recipe.updated_at),
        ]
      );
    }
    console.log(`  Migrated ${recipes.length} recipes`);

    // 3. Migrate tags
    console.log('Migrating tags...');
    const tags = sqlite.prepare('SELECT * FROM tags').all() as Array<{
      id: string;
      name: string;
      created_at: number;
    }>;
    for (const tag of tags) {
      await pgClient.query(
        `INSERT INTO tags (id, name, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [tag.id, tag.name, unixToDate(tag.created_at)]
      );
    }
    console.log(`  Migrated ${tags.length} tags`);

    // 4. Migrate recipe_tags
    console.log('Migrating recipe_tags...');
    const recipeTags = sqlite.prepare('SELECT * FROM recipe_tags').all() as Array<{
      recipe_id: string;
      tag_id: string;
    }>;
    for (const rt of recipeTags) {
      await pgClient.query(
        `INSERT INTO recipe_tags (recipe_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [rt.recipe_id, rt.tag_id]
      );
    }
    console.log(`  Migrated ${recipeTags.length} recipe_tags`);

    // 5. Migrate collections
    console.log('Migrating collections...');
    const collections = sqlite.prepare('SELECT * FROM collections').all() as Array<{
      id: string;
      name: string;
      description: string | null;
      created_at: number;
    }>;
    for (const col of collections) {
      await pgClient.query(
        `INSERT INTO collections (id, name, description, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [col.id, col.name, col.description, unixToDate(col.created_at)]
      );
    }
    console.log(`  Migrated ${collections.length} collections`);

    // 6. Migrate collection_recipes
    console.log('Migrating collection_recipes...');
    const collectionRecipes = sqlite.prepare('SELECT * FROM collection_recipes').all() as Array<{
      collection_id: string;
      recipe_id: string;
      added_at: number;
    }>;
    for (const cr of collectionRecipes) {
      await pgClient.query(
        `INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [cr.collection_id, cr.recipe_id, unixToDate(cr.added_at)]
      );
    }
    console.log(`  Migrated ${collectionRecipes.length} collection_recipes`);

    // 7. Migrate recipe_components
    console.log('Migrating recipe_components...');
    const components = sqlite.prepare('SELECT * FROM recipe_components').all() as Array<{
      id: string;
      parent_recipe_id: string;
      child_recipe_id: string;
      servings_needed: number;
      sort_order: number;
      created_at: number;
    }>;
    for (const comp of components) {
      await pgClient.query(
        `INSERT INTO recipe_components (id, parent_recipe_id, child_recipe_id, servings_needed, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          comp.id,
          comp.parent_recipe_id,
          comp.child_recipe_id,
          comp.servings_needed,
          comp.sort_order,
          unixToDate(comp.created_at),
        ]
      );
    }
    console.log(`  Migrated ${components.length} recipe_components`);

    // 8. Migrate shopping_list_items
    console.log('Migrating shopping_list_items...');
    const shoppingItems = sqlite.prepare('SELECT * FROM shopping_list_items').all() as Array<{
      id: string;
      ingredient: string;
      quantity: string | null;
      category: string | null;
      is_checked: number;
      recipe_id: string | null;
      created_at: number;
    }>;
    for (const item of shoppingItems) {
      await pgClient.query(
        `INSERT INTO shopping_list_items (id, ingredient, quantity, category, is_checked, recipe_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          item.ingredient,
          item.quantity,
          item.category,
          Boolean(item.is_checked),
          item.recipe_id,
          unixToDate(item.created_at),
        ]
      );
    }
    console.log(`  Migrated ${shoppingItems.length} shopping_list_items`);

    // 9. Migrate settings
    console.log('Migrating settings...');
    const settingsRows = sqlite.prepare('SELECT * FROM settings').all() as Array<{
      id: string;
      anthropic_api_key: string | null;
      anthropic_model: string | null;
      anthropic_secondary_model: string | null;
      pexels_api_key: string | null;
      updated_at: number;
    }>;
    for (const s of settingsRows) {
      await pgClient.query(
        `INSERT INTO settings (id, anthropic_api_key, anthropic_model, anthropic_secondary_model, pexels_api_key, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           anthropic_api_key = EXCLUDED.anthropic_api_key,
           anthropic_model = EXCLUDED.anthropic_model,
           anthropic_secondary_model = EXCLUDED.anthropic_secondary_model,
           pexels_api_key = EXCLUDED.pexels_api_key,
           updated_at = EXCLUDED.updated_at`,
        [
          s.id,
          s.anthropic_api_key,
          s.anthropic_model,
          s.anthropic_secondary_model,
          s.pexels_api_key,
          unixToDate(s.updated_at),
        ]
      );
    }
    console.log(`  Migrated ${settingsRows.length} settings`);

    // 10. Migrate memories
    console.log('Migrating memories...');
    const memories = sqlite.prepare('SELECT * FROM memories').all() as Array<{
      id: string;
      user_id: string;
      content: string;
      enabled: number;
      created_at: number;
    }>;
    for (const mem of memories) {
      await pgClient.query(
        `INSERT INTO memories (id, user_id, content, enabled, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [
          mem.id,
          mem.user_id,
          mem.content,
          Boolean(mem.enabled),
          unixToDate(mem.created_at),
        ]
      );
    }
    console.log(`  Migrated ${memories.length} memories`);

    // 11. Migrate agents
    console.log('Migrating agents...');
    const agents = sqlite.prepare('SELECT * FROM agents').all() as Array<{
      id: string;
      name: string;
      description: string | null;
      system_prompt: string;
      icon: string;
      model_id: string | null;
      is_built_in: number;
      user_id: string | null;
      created_at: number;
      updated_at: number;
    }>;
    for (const agent of agents) {
      await pgClient.query(
        `INSERT INTO agents (id, name, description, system_prompt, icon, model_id, is_built_in, user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          agent.id,
          agent.name,
          agent.description,
          agent.system_prompt,
          agent.icon,
          agent.model_id,
          Boolean(agent.is_built_in),
          agent.user_id,
          unixToDate(agent.created_at),
          unixToDate(agent.updated_at),
        ]
      );
    }
    console.log(`  Migrated ${agents.length} agents`);

    await pgClient.query('COMMIT');
    console.log('\n✅ Data migration completed successfully!');

  } catch (error) {
    await pgClient.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    pgClient.release();
    await pgPool.end();
    sqlite.close();
  }
}

migrateData().catch((err) => {
  console.error(err);
  process.exit(1);
});
