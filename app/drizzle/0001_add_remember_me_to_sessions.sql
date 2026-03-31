-- Add remember_me column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS remember_me BOOLEAN NOT NULL DEFAULT false;
