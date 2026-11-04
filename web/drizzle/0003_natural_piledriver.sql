CREATE TABLE `credentials` (
	`player` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`salt` text NOT NULL,
	`hash` text NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credentials_email_unique` ON `credentials` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_player` ON `sessions` (`player`);