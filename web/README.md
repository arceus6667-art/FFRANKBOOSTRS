# RankForge web application

Full-stack TypeScript / React application, using the Next.js-compatible Vinext runtime on Sites (Cloudflare Workers). Structured records persist in D1 and private screenshot evidence in R2. All authoritative mutations run through `/api/v1`; the same boundary can serve a future Android application.

## Local development

Node.js 22.13+ is required.

```sh
npm ci
npm run build
```

Apply each SQL migration in `drizzle/` in filename order to local D1, once per database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_safe_hitman.sql
```

Repeat with the subsequent migration filenames. Then run `npm run dev`. The portable development server prints its loopback address. The maintained local sign-in simulator supplies the disposable identity `seedy@sites.test`; it is excluded from production builds. Set `ADMIN_EMAIL=seedy@sites.test` in ignored `.dev.vars` for organizer testing. Never use that value as the production administrator.

Run `npx tsc --noEmit` here and `npm test` in the repository root. The root tests cover both the earlier PostgreSQL foundation and the deployed D1 constraints. The D1 schema uses migrations, registration triggers, atomic batches and uniqueness constraints; it is never created at request time.

## Hosted operation

`.openai/hosting.json` retains the exact Site identity and DB/BUCKET bindings. Sites provisions persistent storage and applies generated migrations during publication. The initial audience is owner-private. The verified Site owner email is configured as a secret runtime administrator setting. Other roles are assigned from the protected Players module; role changes are checked against current database state.

Secure hosted sign-in is functional without another provider. Optional email/password sign-up, verified sign-in, confirmation callbacks and password recovery are implemented through Supabase Auth when `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are supplied as runtime settings. No Supabase project has been selected or created, so this optional method stays visibly unavailable. Configure email confirmation, the approved redirect origin `/auth-complete`, strong password policies, provider rate limits and production SMTP in the selected Auth project before enabling it. The provider owns Google configuration; no unconfigured Google action is shown.

Only publishable Supabase keys are used. Application sessions use HTTP-only, SameSite cookies; email sessions expire after the Auth access-token window and require sign-in again. Hosted sign-in session handling remains platform-owned. The app never handles game credentials.

## Features

- Exactly five public navigation links, separate account actions, accessible mobile menu and original arena art.
- Supported Free Fire MAX, BGMI and CODM format discovery, event details, versioned rules and configurable points.
- Player profiles, private game UIDs, adult eligibility attestation and policy consent.
- Teams, invitation acceptance/decline/expiry, captain transfers, roster snapshots and duplicate-entry prevention.
- Atomic free event registrations, capacity guards, withdrawal windows, check-in and restricted lobby credentials.
- Organizer event lifecycle, editing drafts, postponement with participant notifications, cancellation and archiving.
- Scheduled matches with explicit registered-entry assignments, including two-entry knockout rounds. Organizers manually seed and schedule subsequent bracket rounds after verification; automated bracket advancement is deferred.
- Screenshot evidence, pending results, independent review, correction history, disputes, and derived player/team standings.
- In-platform notifications, announcements, approved YouTube/Instagram links, support/privacy request tickets and responses.
- Protected organizer modules, role administration, audit history, support contact and signed APK metadata management.
- Android Coming Soon until complete approved release metadata exists. No fabricated download, payment, wallet, wager, publisher affiliation or activity count.

## Operational limits

The initial UI loads bounded lists (200 public events, 500 organizer records, 1,000 standing groups). A high-volume release should add cursor pagination and event-level moderation assignments. Moderators in this release can review all results and disputes; only admins control event/content/role settings. Screenshots are privately stored with a 5 MB PNG/JPEG limit. Privacy requests are received in the support queue; deletion/export and evidence retention review are organizer operations, not automated destructive actions.

Before expanding to public access, review the policy copy and current publisher event rules, publish a verified business contact, and test backup recovery and moderation coverage. No contact number, social identity or APK has been invented.

## Standard account login

The main login form is shared by players and administrators. Role is read from the server database; there is no public organizer signup option. Native password authentication uses a secret AUTH_PEPPER configured in hosted runtime settings, per-account salts and PBKDF2, and stores only hashed session tokens with a seven-day expiry. A one-time secret-gated provisioning action creates the initial administrator. Credentials are delivered privately in the owner chat and are never included in repository source or public UI. Passwords can be changed from Settings; this revokes other sessions.

Password account registration requires ownership of the same verified hosted email. Email delivery/recovery through an external provider is still unconfigured. The reserved test-domain administrator login is deliberately not used to send email. Preserve AUTH_PEPPER securely; rotating it requires credential re-enrollment.
