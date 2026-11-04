CREATE TABLE `support` (
	`id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_verified_winner` ON `results` (`match`) WHERE status = 'verified' AND won = 1;