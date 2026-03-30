import type { RecipeItemList, RecipeItem } from '$lib/server/db/schema';

/**
 * Extract sorted text items from a RecipeItemList
 * Returns items sorted by order, with only the text content
 */
export function getItemTexts(itemList: RecipeItemList | null | undefined): string[] {
  if (!itemList?.items) return [];
  return itemList.items
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(item => item.text)
    .filter(Boolean);
}

/**
 * Get sorted RecipeItems from a RecipeItemList
 * Returns the full item objects sorted by order
 */
export function getSortedItems(itemList: RecipeItemList | null | undefined): RecipeItem[] {
  if (!itemList?.items) return [];
  return itemList.items
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Get a preview of ingredient texts (first N items joined by comma)
 */
export function getIngredientPreview(
  itemList: RecipeItemList | null | undefined,
  maxItems: number = 3
): string {
  const texts = getItemTexts(itemList);
  return texts.slice(0, maxItems).join(', ');
}

/**
 * Check if a RecipeItemList has any items
 */
export function hasItems(itemList: RecipeItemList | null | undefined): boolean {
  return !!itemList?.items && itemList.items.length > 0;
}

/**
 * Get the count of items in a RecipeItemList
 */
export function getItemCount(itemList: RecipeItemList | null | undefined): number {
  return itemList?.items?.length ?? 0;
}

/**
 * Normalize recipe data to ensure ingredients/instructions have proper structure
 * Handles backward compatibility with old string[] format and malformed JSON
 */
export function normalizeRecipeData(recipe: any): any {
  if (!recipe) return recipe;

  const normalized = { ...recipe };

  // Normalize ingredients
  if (!normalized.ingredients || !normalized.ingredients.items) {
    if (Array.isArray(normalized.ingredients)) {
      // Old format: string[]
      normalized.ingredients = {
        items: normalized.ingredients.map((text: string, i: number) => ({
          id: crypto.randomUUID(),
          text,
          order: i
        }))
      };
    } else if (typeof normalized.ingredients === 'object' && normalized.ingredients !== null) {
      // Malformed object - recover if possible or use empty
      try {
        const parsed = typeof normalized.ingredients === 'string'
          ? JSON.parse(normalized.ingredients)
          : normalized.ingredients;
        if (parsed.items && Array.isArray(parsed.items)) {
          normalized.ingredients = {
            items: parsed.items.map((item: any, i: number) => ({
              id: item.id || crypto.randomUUID(),
              text: item.text || '',
              order: item.order ?? i,
              ...(item.checked && { checked: item.checked })
            }))
          };
        } else {
          normalized.ingredients = { items: [] };
        }
      } catch {
        normalized.ingredients = { items: [] };
      }
    } else {
      normalized.ingredients = { items: [] };
    }
  }

  // Normalize instructions (same logic)
  if (!normalized.instructions || !normalized.instructions.items) {
    if (Array.isArray(normalized.instructions)) {
      normalized.instructions = {
        items: normalized.instructions.map((text: string, i: number) => ({
          id: crypto.randomUUID(),
          text,
          order: i
        }))
      };
    } else if (typeof normalized.instructions === 'object' && normalized.instructions !== null) {
      try {
        const parsed = typeof normalized.instructions === 'string'
          ? JSON.parse(normalized.instructions)
          : normalized.instructions;
        if (parsed.items && Array.isArray(parsed.items)) {
          normalized.instructions = {
            items: parsed.items.map((item: any, i: number) => ({
              id: item.id || crypto.randomUUID(),
              text: item.text || '',
              order: item.order ?? i
            }))
          };
        } else {
          normalized.instructions = { items: [] };
        }
      } catch {
        normalized.instructions = { items: [] };
      }
    } else {
      normalized.instructions = { items: [] };
    }
  }

  return normalized;
}
