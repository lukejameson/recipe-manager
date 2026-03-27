import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';

const analyzePhotosSchema = z.object({
  images: z.array(z.string()),
});

// POST /api/recipes/analyze-photo-groups - Analyze photos and group them by recipe
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = await request.json();
    const result = analyzePhotosSchema.safeParse(body);

    if (!result.success) {
      throw error(400, result.error.message);
    }

    const { images } = result.data;

    // Get AI service instance
    const aiService = await AIServiceV2.getInstance();

    if (images.length === 0) {
      return json({ groups: [] });
    }

    // Convert base64 images to ImageData format
    const imageData = images.map(img => {
      const isPng = img.startsWith('data:image/png');
      const base64Data = img.split(',')[1];
      return {
        mimeType: isPng ? 'image/png' : 'image/jpeg',
        data: base64Data
      };
    });

    const systemPrompt = `Analyze these ${images.length} recipe photos and group them by recipe.
Return a JSON array where each element is an array of image indices (0-based) that belong to the same recipe.
Example: [[0, 1], [2, 3, 4]] means images 0 and 1 are one recipe, images 2, 3, 4 are another recipe.`;

    // Analyze photos with AIServiceV2
    const generationResult = await aiService.generateForFeature(AIFeature.PHOTO_GROUPING, {
      systemPrompt,
      messages: [{ role: 'user', content: 'Group these recipe photos by recipe.' }],
      images: imageData,
    });

    const content = generationResult.content;

    // Extract groups from response
    let groups: number[][] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        groups = JSON.parse(jsonMatch[0]) as number[][];
      }
    } catch {
      console.error('Failed to parse groups, returning single group');
      groups = [images.map((_, i) => i)];
    }

    // Convert indices to actual image arrays
    const imageGroups = groups.map(indices =>
      indices.filter(i => i >= 0 && i < images.length).map(i => images[i])
    );

    return json({
      groups: imageGroups,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Analyze photo groups error:', e);
    throw error(500, 'Failed to analyze photos');
  }
};
