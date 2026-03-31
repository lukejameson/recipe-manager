-- Add recipe categories feature

-- Create recipe_categories table
CREATE TABLE recipe_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon_name TEXT, -- Lucide icon name (e.g., 'Flame', 'Wine')
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create unique constraint per user for category names
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_categories_user_name ON recipe_categories(user_id, name);

-- Create recipe_category_tags junction table
CREATE TABLE recipe_category_tags (
  category_id TEXT NOT NULL REFERENCES recipe_categories(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, tag_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipe_categories_user_id ON recipe_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_categories_sort_order ON recipe_categories(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipe_category_tags_category_id ON recipe_category_tags(category_id);
CREATE INDEX IF NOT EXISTS idx_recipe_category_tags_tag_id ON recipe_category_tags(tag_id);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Recipe categories tables created successfully';
END $$;