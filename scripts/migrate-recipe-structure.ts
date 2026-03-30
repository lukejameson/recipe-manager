import { db } from '../app/src/lib/server/db/index.js';
import { recipes } from '../app/src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface RecipeItem {
  id: string;
  text: string;
  order: number;
  checked?: boolean;
}

interface RecipeItemList {
  items: RecipeItem[];
}

function stringArrayToItemList(strings: string[]): RecipeItemList {
  return {
    items: strings
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map((text, i) => ({
        id: randomUUID(),
        text,
        order: i
      }))
  };
}

async function migrateRecipes() {
  const allRecipes = await db.select().from(recipes);
  console.log(`Found ${allRecipes.length} recipes to migrate`);

  let migrated = 0;
  let errors = 0;

  for (const recipe of allRecipes) {
    try {
      // Handle old string[] format
      const ingredients = Array.isArray(recipe.ingredients)
        ? stringArrayToItemList(recipe.ingredients as string[])
        : recipe.ingredients as RecipeItemList;

      const instructions = Array.isArray(recipe.instructions)
        ? stringArrayToItemList(recipe.instructions as string[])
        : recipe.instructions as RecipeItemList;

      await db.update(recipes)
        .set({ ingredients, instructions })
        .where(eq(recipes.id, recipe.id));

      migrated++;
      if (migrated % 10 === 0) {
        console.log(`Migrated ${migrated}/${allRecipes.length}...`);
      }
    } catch (err) {
      console.error(`Failed to migrate recipe ${recipe.id}:`, err);
      errors++;
    }
  }

  console.log(`✅ Migration complete: ${migrated} migrated, ${errors} errors`);
}

migrateRecipes().catch(console.error);
