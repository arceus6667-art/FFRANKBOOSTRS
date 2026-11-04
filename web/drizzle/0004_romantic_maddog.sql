ALTER TABLE `matches` ADD `roomPassword` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `deleted` integer DEFAULT 0 NOT NULL;