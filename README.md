# RankForge — Compete Together

An independent, India-focused esports platform for free-entry Free Fire MAX, BGMI and Call of Duty: Mobile competition.

The full website lives in `web/`. It includes player and organizer workspaces, persistent tournament registration, squads, match check-in, private lobbies, results review, disputes, verified standings, announcements and support tickets.

## Start locally

Use Node.js 22.13 or later. Install dependencies at both levels:

```sh
npm ci
npm --prefix web ci
npm run build
```

Follow [the application setup guide](web/README.md) to apply the local D1 migrations, then run `npm run dev`.

## Validate

```sh
npm test
npm run check
```

Type-check from `web/` with `npx tsc --noEmit`. With a disposable local preview running, `npm run test:local` exercises the complete HTTP workflow. It creates local fixtures and must not be run against a production data store.

## Documentation

- [Product specification, sitemap, roles and journeys](docs/PRODUCT.md)
- [Checkpoint history](docs/CHECKPOINTS.md)
- [Application architecture and operations](web/README.md)
- [Original artwork provenance](web/docs/ASSETS.md)
- [Verification evidence and launch limits](docs/VERIFICATION.md)

The deployed runtime uses Sites / Cloudflare Workers, D1 and R2 so the website can run with durable storage immediately. The earlier Supabase PostgreSQL foundation is retained in `supabase/` for a future managed-PostgreSQL deployment. Standard password login is implemented natively with private, database-backed sessions. Secure hosted identity verifies email ownership before new password-account registration. Optional external email-provider integration is retained separately.

No game passwords, unauthorized boosting, cheats, wagers, entry fees, wallets or payouts are offered. Real events, results, social links, business contacts and APK releases are never fabricated.

## Website

[Open RankForge](https://rankforge-esports-india-ffrb.arceus6667.chatgpt.site). The site is currently public; admin and player operations remain protected by account permissions. Player and admin accounts use the same login form; there is no public organizer choice. The requested admin account was provisioned and verified on the hosted database, and the one-time provisioner has been disabled. Credentials are delivered only in the owner chat.

Administrator login opens the tournament manager directly. Add Tournament and Manage tournaments are visible only to admins. Players complete required game UID setup once; saved identities are reused. Room ID and password are revealed to assigned registered players automatically 15 minutes before match start.
