CREATE TABLE `recipe_components` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_recipe_id` text NOT NULL,
	`child_recipe_id` text NOT NULL,
	`servings_needed` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`parent_recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
