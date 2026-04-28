CREATE TABLE "feature_prompts" (
    "id" text PRIMARY KEY NOT NULL,
    "feature_id" text UNIQUE NOT NULL,
    "content" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL
);--> statement-breakpoint
CREATE TABLE "feature_prompt_history" (
    "id" text PRIMARY KEY NOT NULL,
    "prompt_id" text NOT NULL REFERENCES "feature_prompts"("id") ON DELETE CASCADE,
    "content" text NOT NULL,
    "version" integer NOT NULL,
    "changed_by" text REFERENCES "users"("id") ON DELETE SET NULL,
    "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "feature_prompts_feature_id_idx" ON "feature_prompts"("feature_id");--> statement-breakpoint
CREATE INDEX "feature_prompt_history_prompt_id_idx" ON "feature_prompt_history"("prompt_id");
