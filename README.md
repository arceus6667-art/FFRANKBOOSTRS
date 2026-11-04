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

The deployed runtime uses Sites / Cloudflare Workers, D1 and R2 so the website can run with durable storage immediately. The earlier Supabase PostgreSQL foundation is retained in `supabase/` for a future managed-PostgreSQL deployment. Optional Supabase email authentication is implemented but remains disabled until an explicitly selected project is configured; secure hosted sign-in is available now.

No game passwords, unauthorized boosting, cheats, wagers, entry fees, wallets or payouts are offered. Real events, results, social links, business contacts and APK releases are never fabricated.
