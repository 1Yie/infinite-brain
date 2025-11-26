CREATE TABLE `view_states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`room_id` text NOT NULL,
	`offset_x` integer NOT NULL,
	`offset_y` integer NOT NULL,
	`scale` integer NOT NULL,
	`updated_at` integer
);
