# tworing

**tworing.ai** — a 24/7 AI receptionist for Alberta trades businesses. Answers forwarded
calls within two rings, books appointments into the customer's calendar mid-call, emails
lead summaries, and produces a monthly Found Money Report.

Multi-tenant SaaS: Next.js 16 + Prisma + Postgres. Owns tenants, calls, recordings,
transcripts, leads, booking, billing, the Google and Jobber integrations, the admin views,
and the customer portal.

> **Private repo.** It carries the business logic and data model for real paying clients.

## Setup

```bash
npm ci
cp .env.example .env          # fill in from the password manager — never commit .env
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Secret scanning — run this once per clone

```bash
scripts/install-hooks.sh
```

Git does not clone hooks, so every machine needs this. It points `core.hooksPath` at
`.githooks/`, where a pre-commit hook scans staged content with
[gitleaks](https://github.com/gitleaks/gitleaks) and blocks the commit on a hit. If
gitleaks is missing the hook **fails** rather than passing silently.

`.github/workflows/ci.yml` rescans on every push as a backstop, catching anything
committed with `--no-verify` or from a clone where the hook was never installed.

**A pushed credential is a leaked credential** — `git rm` afterwards does not undo it.
Rotate it instead.

## Deployment

AWS Amplify Hosting builds from this repo on push; see `amplify.yml`. Environment
variables are set in the Amplify console, not in the repo. Region is `ca-west-1`
(Calgary) — data residency is a selling point, so keep it Canadian.

## Layout

| Path | What |
|---|---|
| `app/` | Next.js routes — marketing site, `/login`, `/app` portal, `/admin` |
| `app/api/` | Webhook + tool endpoints the voice engine calls |
| `prisma/` | Schema and migrations |
| `lib/` | Carrier, calendar, and integration clients |
