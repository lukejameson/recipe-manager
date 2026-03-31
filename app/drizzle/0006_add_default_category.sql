-- Add is_default column for default category feature
ALTER TABLE recipe_categories ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;