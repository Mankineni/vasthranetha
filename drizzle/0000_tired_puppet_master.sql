CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`code_prefix` text NOT NULL,
	`tile_image` text,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `events` (
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`product_id`, `type`, `day`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fabrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fabrics_slug_unique` ON `fabrics` (`slug`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`login` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer,
	`batch_id` text,
	`kind` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`original_path` text NOT NULL,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	`variants` text NOT NULL,
	`preview_path` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `occasions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occasions_slug_unique` ON `occasions` (`slug`);--> statement-breakpoint
CREATE TABLE `pages` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_bands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`min` integer NOT NULL,
	`max` integer,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_occasions` (
	`product_id` integer NOT NULL,
	`occasion_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `occasion_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`occasion_id`) REFERENCES `occasions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`category_id` integer NOT NULL,
	`fabric_id` integer,
	`length` text DEFAULT '' NOT NULL,
	`blouse_piece` integer,
	`care` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sizes` text NOT NULL,
	`colours` text NOT NULL,
	`dealer_name` text DEFAULT '' NOT NULL,
	`dealer_code` text DEFAULT '' NOT NULL,
	`dealer_price` integer,
	`notes` text DEFAULT '' NOT NULL,
	`submit_token` text,
	`created_by` integer NOT NULL,
	`updated_by` integer NOT NULL,
	`published_at` integer,
	`sold_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fabric_id`) REFERENCES `fabrics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_submit_token_unique` ON `products` (`submit_token`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`login` text NOT NULL,
	`password_hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_unique` ON `users` (`login`);