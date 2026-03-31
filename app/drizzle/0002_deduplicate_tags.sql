-- Migration: Deduplicate tags before adding unique constraint
-- Runs before drizzle-kit push to ensure no duplicates exist

-- First, delete duplicate tags keeping only the oldest one per (user_id, name)
DELETE FROM tags
WHERE id IN (
  SELECT t1.id
  FROM tags t1
  JOIN tags t2 ON t1.user_id = t2.user_id AND t1.name = t2.name
  WHERE t1.created_at > t2.created_at
     OR (t1.created_at = t2.created_at AND t1.id > t2.id)
);

-- Also delete any tags with NULL name (shouldn't exist but just in case)
DELETE FROM tags WHERE name IS NULL OR name = '';

-- Log the cleanup
DO $$
BEGIN
  RAISE NOTICE 'Tag deduplication complete - duplicates removed';
END $$;
