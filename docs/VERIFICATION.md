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

Native account password login is active and has been tested on the hosted site. New password-account registration requires matching verified hosted-email ownership. External email delivery/recovery and Google provider configuration remain unavailable; no unconfigured provider is advertised as working. No verified business WhatsApp number, social account, or Android package was supplied, so these remain unpublished. Support and privacy requests can still be submitted in the built-in authenticated support queue.

Knockout rounds are manually seeded and scheduled with exactly two registered entries; automatic bracket advancement is deferred. Lists have documented bounded page sizes, and bulk moderation, cursor pagination, automated retention and self-service data deletion/export are future operational work. Policy text and publisher-specific tournament conditions need owner review before a public launch.

Full dependency-tree audit after patching: 0 critical, 0 high, 12 moderate and 1 low findings in development/build tooling. The production dependency audit reports 0 findings. Remaining tooling advisories are not claimed resolved; upgrades must preserve framework and migration-tool compatibility.

## Account-login revision

A single standard login now serves players and administrators, without a public organizer choice or organizer views. Native email/password credentials are salted, peppered PBKDF2 hashes. Only hashed, expiring, revocable session tokens are stored. A one-time secret-gated provisioner creates the requested administrator account; no production login credentials are committed or displayed on the site. Secure hosted identity remains an optional verified-email route. Normal password signup requires matching verified hosted email ownership; unverified emails cannot create credentials.

25 automated checks pass. A further 13 local native-account HTTP checks passed, covering gated provisioning, replay rejection, invalid credentials, normal login, private admin access, password change, previous-session revocation and logout.

## Hosted acceptance checks

Published successfully at https://rankforge-esports-india-ffrb.arceus6667.chatgpt.site with the owner-private audience preserved. Production HTTP checks returned 200 for administrator provisioning, normal password login, protected admin access, and the sign-in page. Session cookies have Secure and HttpOnly flags. Anonymous application identity is null; no production events or standings were fabricated. Login HTML contains neither the requested account credentials nor organizer login controls. After provisioning, the bootstrap secret and automatic owner-email role setting were removed; the saved version was redeployed at environment revision 3. Account credentials and the stable password pepper are absent from repository source.

## Admin controls and onboarding revision

27 automated checks pass, including the exact one-millisecond boundary around T-15 minutes, cancellation/completion/deletion visibility, and ignoring legacy early release timestamps. `scripts/check-admin-setup.mjs` passed 39 local HTTP checks: role-specific login destinations, mandatory UID setup, missing-UID rejection, one-time UID persistence, subsequent dashboard entry, player denial of admin mutations, publish-on-create visible to users, room secrets omitted from discovery, saved-UID-only registration, early room denial, late reveal of both ID and password, outsider denial, edits visible to users, deletion confirmation, participant cancellation history, and secret removal after deletion.

The local browser showed the admin-only Add Tournament toolbar, the Games/Tournaments navigation, the labelled editor, and the separate management controls. The user-side tournament HTML does not include admin add actions. All integration fixtures are local; no demonstration tournaments or game UIDs were added to the hosted database.
