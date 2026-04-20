import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { pantryItems } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';

const CATEGORIES = ['produce', 'dairy', 'meat', 'grains', 'canned', 'condiments', 'spices', 'frozen', 'snacks', 'other'];

function categorizeIngredient(ingredient: string): string {
  const lower = ingredient.toLowerCase();
  if (/lettuce|spinach|kale|tomato|potato|onion|garlic|carrot|celery|cucumber|pepper|mushroom|broccoli|cauliflower|lemon|lime|apple|banana|orange|berry|grape|melon|avocado|herb|basil|cilantro|parsley|ginger/.test(lower)) return 'produce';
  if (/milk|cheese|butter|cream|yogurt|egg/.test(lower)) return 'dairy';
  if (/chicken|beef|pork|turkey|fish|salmon|bacon|sausage|steak|ground/.test(lower)) return 'meat';
  if (/flour|sugar|salt|pepper|oil|vinegar|rice|pasta|bread|noodle|oat|cereal|grain/.test(lower)) return 'grains';
  if (/can|soup|bean|tomato sauce|diced tomato/.test(lower)) return 'canned';
  if (/ketchup|mustard|mayo|sauce|dressing|salsa|soy sauce/.test(lower)) return 'condiments';
  if (/cumin|paprika|cinnamon|nutmeg|oregano|thyme|rosemary|bay|chili|curry|turmeric|garlic powder|onion powder/.test(lower)) return 'spices';
  if (/frozen|ice cream|pizza/.test(lower)) return 'frozen';
  if (/chip|cracker|cookie|candy|nut|popcorn|pretzel/.test(lower)) return 'snacks';
  return 'other';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const schema = z.object({
      text: z.string(),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { text } = result.data;
    const lines = text.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);

    const itemsToInsert = lines.map((line) => {
      const parts = line.split(/[,\s]+/).filter(Boolean);
      const ingredient = parts[0] || line;
      const quantity = parts[1] ? parseFloat(parts[1]) : null;
      const unit = parts[2] || null;
      const category = categorizeIngredient(ingredient);

      return {
        userId: user.id,
        ingredient: ingredient.toLowerCase(),
        displayName: ingredient,
        quantity,
        unit,
        category,
        threshold: 1,
      };
    });

    const newItems = await db
      .insert(pantryItems)
      .values(itemsToInsert)
      .returning();

    return json(newItems);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Quick add pantry error:', e);
    throw error(500, 'Internal server error');
  }
};
