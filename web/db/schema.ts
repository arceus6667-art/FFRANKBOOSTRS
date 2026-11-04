import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const players = sqliteTable('players', {
  id: text().primaryKey(), code: text().notNull().unique(), email: text().notNull(), name: text().notNull(),
  region: text().notNull().default(''), game: text().notNull().default('ffmax'), role: text().notNull().default('player'),
  consent: text().notNull().default(''), adult: integer().notNull().default(0), created: integer().notNull(),
});
export const identities = sqliteTable('identities', {
  id: text().primaryKey(), player: text().notNull().references(() => players.id, {onDelete:'cascade'}),
  game: text().notNull(), name: text().notNull(), uid: text().notNull(),
}, t => [uniqueIndex('identity_player_game').on(t.player,t.game)]);
export const tournaments = sqliteTable('tournaments', {
  id:text().primaryKey(), title:text().notNull(), game:text().notNull(), mode:text().notNull(), format:text().notNull(),
  size:integer().notNull(), capacity:integer().notNull(), description:text().notNull(), rules:text().notNull(),
  status:text().notNull().default('draft'), opens:integer().notNull(), closes:integer().notNull(), starts:integer().notNull(),
  checkin:integer().notNull(), organizer:text().notNull().references(() => players.id),
  archived:integer().notNull().default(0), created:integer().notNull(),
}, t=>[index('events_status_start').on(t.status,t.starts)]);
export const teams = sqliteTable('teams', {
  id:text().primaryKey(), name:text().notNull(), game:text().notNull(), captain:text().notNull().references(()=>players.id), created:integer().notNull(),
});
export const members = sqliteTable('members', {
  id:text().primaryKey(), team:text().notNull().references(()=>teams.id,{onDelete:'cascade'}), player:text().notNull().references(()=>players.id,{onDelete:'cascade'}), joined:integer().notNull(),
}, t=>[uniqueIndex('unique_member').on(t.team,t.player),index('members_player').on(t.player)]);
export const invitations = sqliteTable('invitations', {
  id:text().primaryKey(),team:text().notNull().references(()=>teams.id,{onDelete:'cascade'}), player:text().notNull().references(()=>players.id,{onDelete:'cascade'}), status:text().notNull().default('pending'),expires:integer().notNull(),
},t=>[index('invitations_player').on(t.player)]);
export const registrations = sqliteTable('registrations', {
  id:text().primaryKey(), tournament:text().notNull().references(()=>tournaments.id), captain:text().notNull().references(()=>players.id),team:text().references(()=>teams.id), roster:text().notNull(),created:integer().notNull(),
},t=>[index('registrations_event').on(t.tournament)]);
export const entrants = sqliteTable('entrants', {
  id:text().primaryKey(),registration:text().notNull().references(()=>registrations.id,{onDelete:'cascade'}), tournament:text().notNull().references(()=>tournaments.id),player:text().notNull().references(()=>players.id),
},t=>[uniqueIndex('one_event_entry').on(t.tournament,t.player),index('entrants_player').on(t.player)]);
export const matches = sqliteTable('matches', {
  id:text().primaryKey(),tournament:text().notNull().references(()=>tournaments.id),title:text().notNull(), starts:integer().notNull(),checkin:integer().notNull(),release:integer().notNull(),room:text().notNull().default(''), instructions:text().notNull().default(''),status:text().notNull().default('upcoming'), participants:text().notNull().default('[]'),
},t=>[index('matches_event').on(t.tournament)]);
export const checkins = sqliteTable('checkins', {
  id:text().primaryKey(),match:text().notNull().references(()=>matches.id),player:text().notNull().references(()=>players.id),created:integer().notNull(),
},t=>[uniqueIndex('one_checkin').on(t.match,t.player)]);
export const results = sqliteTable('results', {
  id:text().primaryKey(),match:text().notNull().references(()=>matches.id),registration:text().notNull().references(()=>registrations.id), submitter:text().notNull().references(()=>players.id),placement:integer().notNull(),eliminations:integer().notNull(), won:integer().notNull().default(0),evidence:text().notNull().default(''),status:text().notNull().default('pending'), points:integer().notNull().default(0),reviewer:text(),reason:text().notNull().default(''),created:integer().notNull(),
},t=>[uniqueIndex('one_match_entry_result').on(t.match,t.registration),uniqueIndex('one_verified_winner').on(t.match).where(sql`status = 'verified' AND won = 1`)]);
export const disputes = sqliteTable('disputes', {
  id:text().primaryKey(),result:text().notNull().references(()=>results.id),player:text().notNull().references(()=>players.id), reason:text().notNull(),status:text().notNull().default('open'),resolution:text().notNull().default(''),created:integer().notNull(),
});
export const announcements = sqliteTable('announcements', {
  id:text().primaryKey(),title:text().notNull(),body:text().notNull(),game:text().notNull().default('all'), video:text().notNull().default(''),created:integer().notNull(),
});
export const notifications = sqliteTable('notifications', {
  id:text().primaryKey(),player:text().notNull().references(()=>players.id,{onDelete:'cascade'}), message:text().notNull(),read:integer().notNull().default(0),created:integer().notNull(),
},t=>[index('notifications_player').on(t.player)]);
export const settings = sqliteTable('settings', {key:text().primaryKey(),value:text().notNull()});
export const audit = sqliteTable('audit', {
  id:text().primaryKey(),actor:text().notNull().references(()=>players.id),action:text().notNull(),subject:text().notNull(),created:integer().notNull(),
},t=>[index('audit_time').on(t.created)]);
export const assets = sqliteTable('assets', {id:text().primaryKey(),owner:text().notNull().references(()=>players.id),type:text().notNull(),size:integer().notNull(),created:integer().notNull()});
export const limits = sqliteTable('limits', {key:text().primaryKey(),count:integer().notNull(),expires:integer().notNull()});
export const support = sqliteTable('support', {
  id:text().primaryKey(),player:text().notNull().references(()=>players.id),kind:text().notNull(),
  subject:text().notNull(),message:text().notNull(),status:text().notNull().default('open'),
  response:text().notNull().default(''),created:integer().notNull(),
});
