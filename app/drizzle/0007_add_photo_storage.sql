-- Migration: 0007_add_photo_storage
-- Description: Add storage configs and photos tables for multi-provider photo storage

-- Add admin_id column to users table
ALTER TABLE users ADD COLUMN admin_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Create storage_configs table
CREATE TABLE IF NOT EXISTS storage_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL,
  config JSONB NOT NULL,
  cdn_url TEXT,
  max_upload_size_mb INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  account_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  original_key TEXT NOT NULL,
  thumbnail_key TEXT,
  medium_key TEXT,
  original_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for photos
CREATE INDEX idx_photos_account_id ON photos(account_id);
CREATE INDEX idx_photos_admin_id ON photos(admin_id);
CREATE INDEX idx_photos_recipe_id ON photos(recipe_id);
CREATE INDEX idx_photos_created_at ON photos(created_at);

-- Create trigger to update updated_at on storage_configs
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_storage_configs_updated_at
  BEFORE UPDATE ON storage_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
