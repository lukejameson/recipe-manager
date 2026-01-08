-- SQLite doesn't support altering column constraints directly, so recreate table
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`system_prompt` text NOT NULL,
	`icon` text DEFAULT '🤖' NOT NULL,
	`model_id` text,
	`is_built_in` integer DEFAULT false NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_agents`(`id`, `name`, `description`, `system_prompt`, `icon`, `model_id`, `is_built_in`, `user_id`, `created_at`, `updated_at`)
SELECT `id`, `name`, `description`, `system_prompt`, `icon`, NULL, `is_built_in`, `user_id`, `created_at`, `updated_at` FROM `agents`;--> statement-breakpoint
DROP TABLE `agents`;--> statement-breakpoint
ALTER TABLE `__new_agents` RENAME TO `agents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
