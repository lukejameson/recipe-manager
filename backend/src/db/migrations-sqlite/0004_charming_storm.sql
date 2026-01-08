CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'app-settings' NOT NULL,
	`anthropic_api_key` text,
	`anthropic_model` text DEFAULT 'claude-3-5-sonnet-20241022',
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
