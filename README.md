# Multi-game esports platform

Independent, India-focused community platform for free-entry Free Fire MAX, BGMI and CODM events. No account boosting, game passwords, wagers or payouts.

## Development

Use Node.js 22 or later:

```sh
npm ci
npm test
npm run check
```

Read [the product specification](docs/PRODUCT.md) and [checkpoint status](docs/CHECKPOINTS.md). The repository currently contains tested tournament rules, an identity database migration and API authorization helpers. It does not yet contain a running website.

Tests run without hosted credentials using embedded PostgreSQL. To configure a future staging API, copy `.env.example` to `.env.local` and provide the explicitly selected project's URL and publishable key. No secret/service-role key belongs in browser code or Git.

Hosted migrations, sign-in flows and end-to-end verification remain pending. The official brand, logo, support number and eligibility/consent policy must be confirmed before launch.
