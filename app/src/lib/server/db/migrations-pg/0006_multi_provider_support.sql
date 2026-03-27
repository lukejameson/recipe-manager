-- Multi-provider LLM support tables
--> statement-breakpoint
-- Provider configurations table
CREATE TABLE IF NOT EXISTS "provider_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"api_key" text,
	"base_url" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Feature-to-model mapping table
CREATE TABLE IF NOT EXISTS "feature_model_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"feature_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"model_id" text NOT NULL,
	"temperature" integer,
	"max_tokens" integer,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "provider_configs_provider_idx" ON "provider_configs" ("provider_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_configs_enabled_idx" ON "provider_configs" ("is_enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_model_configs_feature_idx" ON "feature_model_configs" ("feature_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_model_configs_provider_idx" ON "feature_model_configs" ("provider_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_model_configs_enabled_priority_idx" ON "feature_model_configs" ("is_enabled", "priority" DESC);
--> statement-breakpoint
-- Add comments explaining the deprecated columns in settings table
COMMENT ON COLUMN "settings"."anthropic_api_key" IS 'DEPRECATED: Use provider_configs table instead';
--> statement-breakpoint
COMMENT ON COLUMN "settings"."anthropic_model" IS 'DEPRECATED: Use feature_model_configs table instead';
--> statement-breakpoint
COMMENT ON COLUMN "settings"."anthropic_secondary_model" IS 'DEPRECATED: Use feature_model_configs table instead';
