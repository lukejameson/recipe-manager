import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { pantryItems } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

function normalizeIngredient(str: string): string {
  return str.toLowerCase().trim()
    .replace(/ies$/, 'y')
    .replace(/es$/, '')
    .replace(/s$/, '');
}

function fuzzyMatch(shoppingIng: string, pantryIng: string): boolean {
  const a = normalizeIngredient(shoppingIng);
  const b = normalizeIngredient(pantryIng);
  return a === b || a.includes(b) || b.includes(a);
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
      ingredients: z.array(z.string()),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { ingredients } = result.data;

    const pantryItemsList = await db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, user.id));

    const matches = ingredients.map((ingredient) => {
      const match = pantryItemsList.find((p) =>
        fuzzyMatch(ingredient, p.ingredient) || fuzzyMatch(ingredient, p.displayName)
      );

      return {
        ingredient,
        found: !!match,
        pantryItem: match || undefined,
        matchScore: match ? 1 : 0,
      };
    });

    return json(matches);
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Check pantry error:', e);
    throw error(500, 'Internal server error');
  }
};
