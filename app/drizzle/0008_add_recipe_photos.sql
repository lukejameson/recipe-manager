-- Migration: 0008_add_recipe_photos
-- Description: Add recipe_photos junction table and photoId to instructions

-- Add original_url column to photos table for migration tracking
ALTER TABLE photos ADD COLUMN original_url TEXT;

-- Create recipe_photos junction table
CREATE TABLE IF NOT EXISTS recipe_photos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  is_main BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recipe_id, photo_id)
);

-- Create indexes for recipe_photos
CREATE INDEX idx_recipe_photos_recipe_id ON recipe_photos(recipe_id);
CREATE INDEX idx_recipe_photos_photo_id ON recipe_photos(photo_id);
CREATE INDEX idx_recipe_photos_is_main ON recipe_photos(recipe_id, is_main) WHERE is_main = true;

-- Note: The instructions JSONB column needs application-level changes to support photoId in RecipeItem
-- This migration only adds the database structure; the application must handle:
-- 1. Adding photoId field to RecipeItem type
-- 2. API endpoints for managing instruction photos
-- 3. UI components for attaching photos to instructions
