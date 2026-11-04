-- Schema-only triggers at the end enforce atomic registration capacity.
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`game` text DEFAULT 'all' NOT NULL,
	`video` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`subject` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`actor`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_time` ON `audit` (`created`);--> statement-breakpoint
CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`match` text NOT NULL,
	`player` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`match`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_checkin` ON `checkins` (`match`,`player`);--> statement-breakpoint
CREATE TABLE `disputes` (
	`id` text PRIMARY KEY NOT NULL,
	`result` text NOT NULL,
	`player` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`result`) REFERENCES `results`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entrants` (
	`id` text PRIMARY KEY NOT NULL,
	`registration` text NOT NULL,
	`tournament` text NOT NULL,
	`player` text NOT NULL,
	FOREIGN KEY (`registration`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_event_entry` ON `entrants` (`tournament`,`player`);--> statement-breakpoint
CREATE INDEX `entrants_player` ON `entrants` (`player`);--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`game` text NOT NULL,
	`name` text NOT NULL,
	`uid` text NOT NULL,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_player_game` ON `identities` (`player`,`game`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL,
	`player` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`team`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitations_player` ON `invitations` (`player`);--> statement-breakpoint
CREATE TABLE `limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament` text NOT NULL,
	`title` text NOT NULL,
	`starts` integer NOT NULL,
	`checkin` integer NOT NULL,
	`release` integer NOT NULL,
	`room` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `matches_event` ON `matches` (`tournament`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL,
	`player` text NOT NULL,
	`joined` integer NOT NULL,
	FOREIGN KEY (`team`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_member` ON `members` (`team`,`player`);--> statement-breakpoint
CREATE INDEX `members_player` ON `members` (`player`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`message` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_player` ON `notifications` (`player`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`game` text DEFAULT 'ffmax' NOT NULL,
	`role` text DEFAULT 'player' NOT NULL,
	`consent` text DEFAULT '' NOT NULL,
	`adult` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_code_unique` ON `players` (`code`);--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament` text NOT NULL,
	`captain` text NOT NULL,
	`team` text,
	`roster` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`captain`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `registrations_event` ON `registrations` (`tournament`);--> statement-breakpoint
CREATE TABLE `results` (
	`id` text PRIMARY KEY NOT NULL,
	`match` text NOT NULL,
	`registration` text NOT NULL,
	`submitter` text NOT NULL,
	`placement` integer NOT NULL,
	`eliminations` integer NOT NULL,
	`won` integer DEFAULT 0 NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`reviewer` text,
	`reason` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`match`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registration`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitter`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_match_entry_result` ON `results` (`match`,`registration`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`game` text NOT NULL,
	`captain` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`captain`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`game` text NOT NULL,
	`mode` text NOT NULL,
	`format` text NOT NULL,
	`size` integer NOT NULL,
	`capacity` integer NOT NULL,
	`description` text NOT NULL,
	`rules` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`opens` integer NOT NULL,
	`closes` integer NOT NULL,
	`starts` integer NOT NULL,
	`checkin` integer NOT NULL,
	`organizer` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`organizer`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_status_start` ON `tournaments` (`status`,`starts`);

--> statement-breakpoint
CREATE TRIGGER registration_guard BEFORE INSERT ON registrations BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id=NEW.tournament
      AND t.status='registration_open' AND t.archived=0
      AND t.opens <= CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
      AND t.closes > CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
  ) THEN RAISE(ABORT, 'registration_closed') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM registrations WHERE tournament=NEW.tournament)
    >= (SELECT capacity FROM tournaments WHERE id=NEW.tournament)
    THEN RAISE(ABORT, 'event_full') END;
  SELECT CASE WHEN NOT json_valid(NEW.roster) OR json_array_length(NEW.roster)
    <> (SELECT size FROM tournaments WHERE id=NEW.tournament)
    OR (SELECT COUNT(DISTINCT value) FROM json_each(NEW.roster)) <> json_array_length(NEW.roster)
    OR NOT EXISTS (SELECT 1 FROM json_each(NEW.roster) WHERE value=NEW.captain)
    THEN RAISE(ABORT, 'roster_invalid') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.roster) j
    WHERE NOT EXISTS (SELECT 1 FROM players p JOIN identities i ON i.player=p.id
      WHERE p.id=j.value AND p.adult=1 AND p.consent='2026-11-v1'
        AND i.game=(SELECT game FROM tournaments WHERE id=NEW.tournament) AND length(trim(i.uid))>0)
  ) THEN RAISE(ABORT, 'player_ineligible') END;
  SELECT CASE WHEN (SELECT size FROM tournaments WHERE id=NEW.tournament)>1 AND (
    NOT EXISTS (SELECT 1 FROM teams tm WHERE tm.id=NEW.team AND tm.captain=NEW.captain
      AND tm.game=(SELECT game FROM tournaments WHERE id=NEW.tournament))
    OR EXISTS (SELECT 1 FROM json_each(NEW.roster) j WHERE NOT EXISTS (
      SELECT 1 FROM members m WHERE m.team=NEW.team AND m.player=j.value))
  ) THEN RAISE(ABORT, 'roster_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER entrant_guard BEFORE INSERT ON entrants BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM registrations r, json_each(r.roster) j
    WHERE r.id=NEW.registration AND r.tournament=NEW.tournament AND j.value=NEW.player
  ) THEN RAISE(ABORT, 'roster_invalid') END;
END;
