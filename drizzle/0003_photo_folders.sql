CREATE TABLE `photo_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp DEFAULT NULL,
	`owner_user_id` int NOT NULL,
	`parent_id` int,
	`name` varchar(255) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `photo_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `photo_folders` ADD CONSTRAINT `photo_folders_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;