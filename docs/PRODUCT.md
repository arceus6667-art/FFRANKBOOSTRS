# Product requirements and implementation contract

Status: initial specification, 5 November 2026. Brand identity is pending. All events are free entry. Website launches before Android. This document describes intended behavior; it does not claim those features already exist.

## 1. Product requirements

Serve Indian players of Free Fire MAX, BGMI, and CODM through a shared API and database. A player can discover an eligible event, register, check in, receive restricted lobby instructions, submit evidence, and see verified results. An organizer can manage the complete event lifecycle with accountable moderation.

Use INR only if future approved non-wager commercial features require currency; MVP has no payment flow. Store timestamps in UTC and display Asia/Kolkata with explicit timezone labels. Do not invent activity counts, achievements, rankings, or app downloads. Empty states explain what happens next.

Registration collects email, display name, preferred game, private game UID and in-game name, region, and policy consent. Never collect game passwords. Platform player IDs are immutable and distinct from game UIDs. Email verification is required before registration. Google login is enabled only after provider configuration. Recovery uses expiring, single-use links and generic responses.

Age eligibility and consent requirements must be reviewed for the launch jurisdiction and game policies before launch. Collect only necessary eligibility information; define retention and deletion procedures. Keep minors' private data out of public profiles. Do not launch registration until this policy is approved and enforced on the server.

Acceptance: all registration writes are atomic, capacity cannot be exceeded by concurrent requests, a player cannot occupy multiple entries in the same event, disabled formats cannot be registered, and private UIDs/lobbies cannot be read by unauthorised users.

## 2. Sitemap

Exactly five public navigation items: **Home**, **Tournaments**, **Games**, **Leaderboard**, **Download App**. Sign In / Register appears separately on desktop; mobile has a labelled hamburger and accessible sign-in action.

Public routes: `/`, `/tournaments`, `/tournaments/[id]`, `/games`, `/games/[slug]`, `/leaderboard`, `/download-app`. Footer routes: `/privacy`, `/terms`, `/fair-play`, `/community-guidelines`, `/support`, `/cancellation-policy`. Auth routes: `/sign-in`, `/register`, `/recover`, `/auth/callback`.

Authenticated routes: `/dashboard`, `/my-matches`, `/my-teams`, `/profile`, `/notifications`, `/settings`. Team detail and invitation acceptance are protected. Admin routes live under `/admin`; hiding links is never the authorization boundary.

## 3. User-role matrix

| Capability | Visitor | Player | Moderator | Admin |
| --- | --- | --- | --- | --- |
| Read published tournaments and verified standings | Yes | Yes | Yes | Yes |
| Manage own profile, registrations, evidence, disputes | No | Own only | Own only | Own only |
| Manage team roster | No | Captain of team | Captain of team | Audited intervention |
| Read lobby instructions | No | Eligible checked-in entrant, within release window | Assigned events | Yes |
| Review results and disputes | No | No | Assigned events | Yes |
| Publish, postpone, cancel, archive tournaments | No | No | No | Yes |
| Manage roles, settings, APKs and content | No | No | No | Yes |
| Read audit logs | No | No | Assigned moderation scope | Yes |

Role assignments are server-controlled. Prevent self-review of submitted results. Role changes and sensitive access are audited. Service credentials never reach browsers or mobile clients.

## 4. User journeys

1. Visitor filters events by game, mode, time and availability, reads rules, registers an account, verifies email, completes eligibility, and joins an event. Closed/full/disabled events explain why joining is unavailable.
2. Captain creates a team, invites platform players, and sees accepted eligible roster members. Invitations expire; recipients accept or decline. Registration snapshots the roster so later team changes cannot silently alter entrants.
3. Registered player checks in before the deadline and sees lobby credentials only during the configured release window. Notifications report scheduling changes and cancellation; recovery instructions remain available.
4. Captain/player submits a result and optional screenshot. Result stays Pending until a different authorised reviewer verifies it. Published standings recalculate from verified records only.
5. Player raises a dispute within the event's configured window. Moderator records a reasoned resolution; corrections create result revisions and trigger standings recalculation with an audit record.
6. Admin creates a draft, validates format/rules, opens registration, closes it, schedules matches, releases lobbies, verifies results and completes or cancels the event. Postponement preserves entries and records previous/new times. Archive is a separate flag, not destruction.

## 5. Functional modules

| Module | MVP responsibility | Later |
| --- | --- | --- |
| Identity | Email auth/recovery, profile, roles, consent, account deletion process | Optional phone verification |
| Discovery | Five public pages, event filters, details, honest empty states | Personal recommendations |
| Tournament operations | Draft/publish/edit/postpone/cancel/archive, free registration, scheduling/check-in | Advanced bracket automation |
| Teams | Invitations, captain, unique roster, eligibility and roster snapshots | Expanded team analytics |
| Player workspace | Stored registrations, calendar, results, stats, team, notifications and completion | Advanced achievements |
| Results | Evidence upload, review, disputes, verified standings | Automated evidence assistance |
| Content | Announcements, approved highlight links, FAQs, policies and support | More editorial tools |
| Administration | Players, events, entries, matches, teams, lobbies, results, rankings, moderation, content, assets, settings and audit | Delegated organizer accounts |
| App distribution | Coming Soon with no download button | Approved signed APK metadata and Google Play |

## 6. Game rules architecture

Keep a versioned server-side game/mode catalog and validate every event against it. Copy the validated rules and version into the published event. After registration starts, material changes require notification and an explicit audited process. Never infer compatibility solely from team size.

Free Fire MAX: Clash Squad challenges support 1v1, 2v2 and 4v4; single matches and configurable knockout brackets. Battle Royale is disabled until explicitly enabled with a reviewed rule definition.

BGMI: Battle Royale supports configured solo, duo and squad events. Placement points, elimination points, counted matches and tie-break ordering are event-specific. Unsupported custom formats stay disabled until configured and reviewed.

CODM: Team Deathmatch, Search & Destroy, Hardpoint and Control initially use reviewed 5v5 configurations. Battle Royale initially uses squad size 4. These are conservative platform configurations, not claims about all publisher-supported formats. Maps, score limits, round limits and permitted format combinations require a versioned rule profile before publishing. Additional challenges stay disabled until reviewed.

Knockouts require explicit seeding, byes, best-of count and advancement rules. Never treat an unverified or disputed result as final advancement. BR standings sum configured placement and elimination points from verified results; tie-breaks must be published before registration. Ties that remain unresolved share rank or require admin resolution according to published rules, never arbitrary hidden ordering.

## 7. Database entity overview

Use PostgreSQL as source of truth with migrations, foreign keys and row-level authorization. Proposed entities:

- `profiles`, `game_profiles`, `role_assignments`, `consent_records`: unique platform identity, private game identity, controlled permissions and consent versions.
- `games`, `mode_profiles`, `rule_versions`: enabled formats and immutable published rules.
- `teams`, `team_members`, `team_invitations`: unique `(team_id, player_id)`; captain transitions and last-captain departure are transactional.
- `tournaments`, `tournament_rules`, `registrations`, `registration_members`: UTC windows, capacity, organizer, lifecycle and immutable roster snapshots. Unique `(tournament_id, player_id)` across roster members.
- `matches`, `match_participants`, `check_ins`, `lobby_secrets`: schedules and restricted credentials stored separately from public event data.
- `result_submissions`, `result_evidence`, `result_revisions`, `disputes`, `standings`: review state and versioned verification. Standings are derived, never user-writable.
- `announcements`, `media_assets`, `notifications`, `apk_releases`, `platform_settings`, `audit_events`: managed content and operational history.

Registration transaction locks the event, validates windows/state/eligibility, checks roster uniqueness, increments capacity usage and creates entries together. Enforce constraints in the database, not only application code. Evidence lives in a private bucket with short-lived signed access, MIME/size checks and retention. Audit records are append-only for application roles and exclude passwords, tokens and raw lobby secrets.

## 8. API architecture

Plan Next.js/TypeScript web frontend with a versioned `/api/v1` service boundary reusable by Android. PostgreSQL and managed auth/storage are the proposed backend; provider configuration belongs in a later implementation checkpoint. Validate inputs, authorize each resource, paginate lists, rate-limit sensitive actions and return structured errors with correlation IDs. Never log secrets.

| API family | Operations | Boundary |
| --- | --- | --- |
| `/games`, `/tournaments`, `/standings` | Read published records and verified standings | Public, paginated |
| `/me` | Profile, game identities, consent, notifications | Authenticated owner |
| `/teams`, `/invitations` | Create, invite, accept/decline, transfer captain, leave | Member/captain checks |
| `/tournaments/:id/registrations` | Register or cancel | Verified eligible identity; idempotent transaction |
| `/matches/:id/check-in`, `/lobby` | Check in; read released instructions | Entrant and time-window checks |
| `/matches/:id/results`, `/disputes` | Submit evidence/results or dispute | Participant scoped |
| `/admin/*` | Manage events/content, review/publish results, roles and audits | Admin or assigned moderator |

Use idempotency keys for mutation retries, CSRF protection for cookie sessions, secure HTTP-only cookies, origin validation, safe redirects and server-side session checks. UI rendering must not leak private records through shared caches. Background notifications and standings recalculation need retryable jobs with deduplication. External media accepts approved HTTPS providers only. APK publishing later requires approved signing provenance, version, release notes, minimum Android version, size, release date, SHA-256 and verified HTTPS URL.

## 9. Delivery roadmap

Checkpoint 1 delivers this specification and tested core rules. Checkpoint 2 delivers schema/auth and authorization tests. Checkpoint 3 delivers public pages and transactional event registration. Checkpoint 4 delivers teams, player dashboard, check-in and lobby release. Checkpoint 5 delivers full organizer management, verified results/disputes, content, notifications and standings. Checkpoint 6 delivers launch validation.

All five game/public navigation pages, email auth, supported initial game formats, teams, free events, protected admin, results review, support and policies belong to the website MVP. APK binaries, phone verification, Play distribution and disabled formats are future work. No wallet, wagers, paid-entry prize pools, payouts, cheats, account access, unauthorized boosting or modified clients are in scope.

## 10. Testing and launch checklist

- Domain: every mode/team/format combination; invalid states/windows; disabled modes; finite scoring; pending results excluded; published tie-break behavior.
- Database: simultaneous final-slot registrations, duplicate roster identities, cancellation/retry idempotency, rollback, cross-event authorization and role escalation attempts.
- Auth: verification, recovery expiry/reuse, logout, protected routes/API, CSRF, rate limiting and no game-password fields.
- Teams: expired invites, non-captain actions, duplicate members, roster snapshots and captain transfer.
- Operations: postponement/cancellation notifications, check-in deadline boundaries, lobby release and access expiry, bracket advancement and result correction.
- Security: private UID/evidence/lobby isolation, upload validation, content sanitization, signed URL expiry, log redaction and secret scanning.
- Experience: keyboard and screen-reader navigation, mobile menus/forms, contrast, focus/error handling, loading/offline/empty states and Asia/Kolkata times.
- Launch: approve brand/contact, legal/age/consent policies and current publisher rules; configure production auth/HTTPS/domain/email; verify backup restoration, monitoring and incident/moderation ownership; run end-to-end tests with real staging persistence; confirm no fake metrics or app links.

Success measures after launch: successful eligible registrations, check-in completion, dispute resolution time and reliable verified-result publication. Establish baselines from actual stored activity.
