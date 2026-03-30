import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Health check endpoint for Docker/container orchestration
export const GET: RequestHandler = async () => {
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
};
