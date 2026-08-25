# Bilco Platform

Multi-tenant web platform behind the Bilco Works AI receptionist. One pipeline serves every tier — tiers are entitlements, not separate products.

| Tier | Price (CAD/mo) | Gets |
|---|---|---|
| Answer | $179 | AI answers + email/SMS lead summary (no login) |
| Office | $349 | Portal: call log, transcripts, recordings, two-way SMS |
| Operations | $599 | + lead pipeline (light CRM), Jobber/HubSpot sync |
| Custom | quoted | Multi-location, managed phone |

Full business model: `C:\Users\login\Documents\Bilco_Platform_Business_Plan_v4.md` (current; v3 preserved alongside it)

## Architecture

```
Caller → VoIP.ms DID → Vapi assistant (per-tenant)
                          │ end-of-call-report webhook
                          ▼
              POST /api/ingest/vapi  (X-Bilco-Ingest-Key per tenant)
                          │
                          ▼
                     Postgres (Prisma)
            orgs · users · calls · leads · keys
                          │
                          ▼
            Portal (Office/Operations tiers)
```

n8n (LXC 127) remains the notification/integration sidecar — it currently owns
live call events and the owner-summary email. As the platform matures, n8n
subscribes to this app's events instead of receiving Vapi's directly.

## Dev setup

```bash
cp .env.example .env
docker compose up -d db        # Postgres 16 on localhost:5433
npx prisma migrate dev         # create schema
npm run dev
```

## Deployment

Runs on a single **EC2 instance in `ca-west-1`** (Calgary — data residency is a selling
point), behind the Cloudflare that already fronts the domain. Deploy is `git pull` + build +
`systemctl restart` — see [`deploy.md`](deploy.md).

Amplify Hosting and App Runner are **not available in `ca-west-1`**, which is why this is a
plain instance rather than a managed deploy.

## Status / roadmap (Phase 1 of the v3 plan)

- [x] Next.js scaffold (App Router, TS, Tailwind)
- [x] Multi-tenant Prisma schema (Org, User, Membership, PhoneNumber, Call, Lead, IngestKey)
- [x] Vapi end-of-call ingestion endpoint with per-tenant hashed keys
- [ ] First migration applied against local Postgres
- [ ] Auth (credentials via Auth.js) + org-scoped sessions
- [ ] Read-only portal: call log, call detail (transcript, recording, summary)
- [ ] Lead inbox (read-only in Phase 1; pipeline states are Phase 3)
- [ ] Vapi → platform webhook cutover (n8n becomes subscriber)

## Decisions

- **Prisma + Postgres** — matches the existing bilcoworks-site stack.
- **Tiers as an enum on Org** — entitlement limits (minute caps, seat counts) live in code, keyed by tier; revisit if per-org overrides become real.
- **Ingest auth = per-tenant random key, SHA-256 stored** — Vapi can send custom headers per assistant; n8n can forward with the same header during transition.
- **Only end-of-call-report persisted** — live status/transcript events return 204 and stay n8n's job until the portal needs them.
- **Local dev DB on port 5433** — 5432 is taken by an existing Postgres in WSL2.
