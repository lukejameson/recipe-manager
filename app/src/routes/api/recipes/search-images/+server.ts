import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';

const searchImagesSchema = z.object({
  query: z.string().min(1),
  tags: z.array(z.string()).optional(),
  page: z.number().int().min(1).optional(),
});

// POST /api/recipes/search-images - Search for recipe images
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = searchImagesSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { query, tags, page = 1 } = result.data;

    // Get Pexels API key from environment
    const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

    if (!PEXELS_API_KEY) {
      throw error(503, 'Image search is not configured');
    }

    // Build search query
    let searchQuery = query;
    if (tags && tags.length > 0) {
      searchQuery = `${query} ${tags.join(' ')}`;
    }

    // Call Pexels API
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=12&page=${page}`,
      {
        headers: {
          'Authorization': PEXELS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw error(500, 'Failed to search images');
    }

    const data = await response.json();

    const images = data.photos.map((photo: any) => ({
      url: photo.src.large || photo.src.medium,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
    }));

    return json({
      images,
      page,
      total: data.total_results,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Search images error:', e);
    throw error(500, 'Failed to search images');
  }
};
