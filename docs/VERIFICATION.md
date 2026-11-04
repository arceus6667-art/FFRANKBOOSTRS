# Verification record

Date: 5 November 2026 (Asia/Kolkata).

## Automated checks

- 23 passing domain and database checks: supported formats, lifecycle transitions, exact registration-window boundaries, duplicate identities, capacity rollback, roster eligibility, private PostgreSQL records, consent immutability, role escalation prevention, verified-only scoring and conflicting-winner prevention.
- TypeScript strict type check passes.
- Production Worker build passes.
- Production dependency audit: zero known vulnerabilities after updating the starter dependencies and transitive packages.
- Local HTTP workflow initially passed 30 assertions: anonymous admin access denied; profile and private game identity persisted; squad creation; unpublished drafts excluded from discovery; publication; atomic registration; duplicate rejection; current registration counts; game UID omitted from public data; scheduling; check-in; room secret omitted from match lists; cross-origin mutation denied; pending result submission; self-review blocked; disputes persisted; self-resolution blocked; announcement publication/removal.

The repeatable `scripts/check-local.mjs` passed 40 HTTP assertions, including an independent-review fixture, published standings, support request/response delivery, completion and archiving. Test data belongs only to the local D1 database. Production starts without invented events, players, match counts or rankings.

## Browser checks

The homepage, sign-in, game discovery, player hub and organizer console render in the browser. The homepage was inspected at desktop width and at a 390 px mobile breakpoint; artwork, typography, stacked content and navigation respond to the viewport. The organizer console rendered stored local records with no browser console errors in the checked view.

## Security boundaries

- Hosted identity is supplied by Sites dispatch; portable mock sign-in is excluded from production builds.
- Every mutation validates identity, current role and request origin. Inputs use prepared statements; sensitive operations have persistent rate limits.
- D1 atomic batches, unique indexes and triggers enforce capacity, exact roster eligibility and one event entry per player.
- Assigned match rosters restrict check-in, result submission and lobby access. Lobbies also require check-in and the release window.
- Private screenshot evidence accepts bounded PNG/JPEG content, is accessible only to the uploader and authorized reviewers, and reviewer reads are audited.
- Results remain excluded from rankings until independently verified. Disputes remove records from standings until reviewed again.
- Role changes and result corrections are recorded. HTML and API responses with identity data are not shared-cacheable.

## Deliberate launch limits

The first hosted audience remains owner-private. The owner account receives organizer access through a secret verified-owner configuration. No public access expansion was made.

Email/password authentication needs Supabase Auth runtime configuration and provider testing; Google sign-in is not advertised while unconfigured. Secure hosted sign-in works independently. No verified business WhatsApp number, social account, or Android package was supplied, so these remain unpublished. Support and privacy requests can still be submitted in the built-in authenticated support queue.

Knockout rounds are manually seeded and scheduled with exactly two registered entries; automatic bracket advancement is deferred. Lists have documented bounded page sizes, and bulk moderation, cursor pagination, automated retention and self-service data deletion/export are future operational work. Policy text and publisher-specific tournament conditions need owner review before a public launch.

Full dependency-tree audit after patching: 0 critical, 0 high, 12 moderate and 1 low findings in development/build tooling. The production dependency audit reports 0 findings. Remaining tooling advisories are not claimed resolved; upgrades must preserve framework and migration-tool compatibility.
