-- Multi-user system migration
-- This migration adds user ownership to all data tables and creates the invite codes system

-- Step 1: Add new columns to users table (these don't need data migration)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "feature_flags" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;

-- Step 2: Add default_feature_flags to settings
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "default_feature_flags" jsonb;

-- Step 3: Create invite_codes table
CREATE TABLE IF NOT EXISTS "invite_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_by" text NOT NULL,
	"used_by" text,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);

-- Step 4: Add user_id columns as NULLABLE first (to allow for existing data)
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "shopping_list_items" ADD COLUMN IF NOT EXISTS "user_id" text;

-- Step 5: Drop the unique constraint on tags.name (will be replaced with composite unique)
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_name_unique";

-- Step 6: Create the admin user from existing data or create a placeholder
-- This inserts the admin user with id 'admin-user' if it doesn't exist
INSERT INTO "users" ("id", "username", "password_hash", "is_admin", "created_at")
VALUES (
  'admin-user',
  'admin',
  -- Default password hash for 'changeme123' - should be changed immediately
  '$2a$10$placeholder.hash.will.be.set.by.app',
  true,
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET "is_admin" = true;

-- Step 7: Assign all existing data to the admin user
UPDATE "recipes" SET "user_id" = 'admin-user' WHERE "user_id" IS NULL;
UPDATE "tags" SET "user_id" = 'admin-user' WHERE "user_id" IS NULL;
UPDATE "collections" SET "user_id" = 'admin-user' WHERE "user_id" IS NULL;
UPDATE "shopping_list_items" SET "user_id" = 'admin-user' WHERE "user_id" IS NULL;
UPDATE "memories" SET "user_id" = 'admin-user' WHERE "user_id" = 'admin-user' OR "user_id" IS NULL;
UPDATE "agents" SET "user_id" = 'admin-user' WHERE "user_id" IS NULL AND "is_built_in" = false;

-- Step 8: Now make user_id columns NOT NULL
ALTER TABLE "recipes" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "tags" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "collections" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "shopping_list_items" ALTER COLUMN "user_id" SET NOT NULL;

-- Step 9: Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Step 10: Add composite unique constraint for tags (user_id + name)
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_name_unique" UNIQUE("user_id","name");
