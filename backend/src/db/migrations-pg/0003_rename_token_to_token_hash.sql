-- Rename token column to token_hash for clarity (stores SHA-256 hash of actual token)
-- First, clear all existing sessions since the tokens are unhashed
TRUNCATE TABLE "sessions";
--> statement-breakpoint
-- Drop the unique constraint on token
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_token_unique";
--> statement-breakpoint
-- Rename the column
ALTER TABLE "sessions" RENAME COLUMN "token" TO "token_hash";
--> statement-breakpoint
-- Add the unique constraint back on token_hash
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash");
