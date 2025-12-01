ALTER TABLE `rooms` RENAME TO `board_rooms`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_strokes` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`data` text NOT NULL,
	`is_deleted` integer DEFAULT false,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`room_id`) REFERENCES `board_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_strokes`("id", "room_id", "user_id", "data", "is_deleted", "created_at") SELECT "id", "room_id", "user_id", "data", "is_deleted", "created_at" FROM `strokes`;--> statement-breakpoint
DROP TABLE `strokes`;--> statement-breakpoint
ALTER TABLE `__new_strokes` RENAME TO `strokes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;