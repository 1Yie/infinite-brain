CREATE TABLE `color_clash_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`color` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`is_connected` integer DEFAULT true,
	`last_activity` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `color_clash_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`max_players` integer DEFAULT 8 NOT NULL,
	`game_time` integer DEFAULT 300 NOT NULL,
	`canvas_width` integer DEFAULT 800 NOT NULL,
	`canvas_height` integer DEFAULT 600 NOT NULL,
	`is_private` integer DEFAULT false,
	`password` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`game_start_time` integer,
	`game_end_time` integer,
	`winner_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `guess_draw_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`has_guessed` integer DEFAULT false,
	`is_drawing` integer DEFAULT false,
	`joined_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`room_id`) REFERENCES `guess_draw_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guess_draw_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`max_players` integer DEFAULT 8 NOT NULL,
	`current_players` integer DEFAULT 0 NOT NULL,
	`total_rounds` integer DEFAULT 3 NOT NULL,
	`round_time_limit` integer DEFAULT 60 NOT NULL,
	`is_private` integer DEFAULT false,
	`password` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`current_round` integer DEFAULT 0 NOT NULL,
	`current_drawer_id` text,
	`current_word` text,
	`word_hint` text,
	`round_start_time` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `guess_draw_used_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`word` text NOT NULL,
	`used_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`room_id`) REFERENCES `guess_draw_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guess_draw_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`category` text DEFAULT '通用' NOT NULL,
	`difficulty` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guess_draw_words_word_unique` ON `guess_draw_words` (`word`);--> statement-breakpoint
CREATE TABLE `user_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`total_strokes` integer DEFAULT 0 NOT NULL,
	`today_strokes` integer DEFAULT 0 NOT NULL,
	`total_pixels` integer DEFAULT 0 NOT NULL,
	`today_pixels` integer DEFAULT 0 NOT NULL,
	`last_updated` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_stats_user_id_unique` ON `user_stats` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `view_states_user_room_unique` ON `view_states` (`user_id`,`room_id`);