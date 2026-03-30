import { db } from '../app/src/lib/server/db/index.js';
import { recipes } from '../app/src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

interface RecipeItemList {
  items: Array<{ text: string; order: number }>;
}

function itemListToStringArray(list: RecipeItemList): string[] {
  if (!list || !list.items) return [];
  return list.items
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(item => item.text)
    .filter(Boolean);
}

async function rollbackRecipes() {
  const allRecipes = await db.select().from(recipes);
  console.log(`Found ${allRecipes.length} recipes to rollback`);

  let rolledBack = 0;
  let errors = 0;

  for (const recipe of allRecipes) {
    try {
      const ingredients = itemListToStringArray(recipe.ingredients as unknown as RecipeItemList);
      const instructions = itemListToStringArray(recipe.instructions as unknown as RecipeItemList);

      await db.update(recipes)
        .set({ ingredients, instructions })
        .where(eq(recipes.id, recipe.id));

      rolledBack++;
    } catch (err) {
      console.error(`Failed to rollback recipe ${recipe.id}:`, err);
      errors++;
    }
  }

  console.log(`✅ Rollback complete: ${rolledBack} rolled back, ${errors} errors`);
}

rollbackRecipes().catch(console.error);
