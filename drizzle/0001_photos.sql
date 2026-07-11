CREATE TABLE `photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp DEFAULT NULL,
	`owner_user_id` int NOT NULL,
	`folder_id` int,
	`title` varchar(255),
	`artist` varchar(255),
	`year` varchar(255),
	`caption` text,
	`filename` varchar(255),
	`url` varchar(255) NOT NULL,
	`thumbnail_url` varchar(255),
	CONSTRAINT `photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `photos` ADD CONSTRAINT `photos_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;