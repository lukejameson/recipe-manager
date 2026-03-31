-- Add tag_patterns column for wildcard tag matching
ALTER TABLE recipe_categories ADD COLUMN tag_patterns TEXT[] DEFAULT '{}';
