# BOSE RC1

BOSE is a Telegram-first Business OS Engine built on the existing product runtime, not a rewrite.  
This repository contains the BOSE core, the Telegram bot and Mini App shell, core APIs and read models, and the first live vertical module: `Furneq`.

## What BOSE RC1 already includes

- BOSE core foundation:
  - `Company`
  - `User`
  - `Role`
  - `Lead`
  - `Client`
  - `Deal`
  - `Task`
  - `Followup`
  - `Appointment`
  - `Conversation`
  - `Message`
  - `Notification`
  - `BusinessEvent`
- Telegram bot with internal and client flows
- Telegram Mini App shell, auth verification scaffold, launch analytics, and session capture
- Postgres-backed runtime state
- Core APIs and core read models
- BOSE dashboard and workboard
- AI MVP:
  - AI Sales Assistant
  - AI CRM Assistant
- Furneq as the first live module on top of BOSE

## Product shape

BOSE is the reusable operating system.

Furneq is the first working module that proves the system on a live domain:

- inbound requests
- deal flow
- measurements
- estimate flow
- workshop control

## Repository map

```text
app/               Next.js pages and API routes
components/        Reusable UI and action controls
database/          Core and runtime migrations, seed, validation SQL
docs/              Setup, deployment, roadmap, and contributor docs
lib/core/          BOSE core maps, transitions, events, read models
lib/telegram/      Telegram Mini App auth and Telegram-specific helpers
lib/ai/            Unified BOSE AI service and agent registry
lib/modules/       Module registry and Furneq manifest
lib/               Runtime services, DB, bot logic, server data orchestration
scripts/           Bootstrap, validation, Telegram, and release scripts
```

## Local start

```powershell
npm install
npm run dev
```

If port `3000` is already in use:

```powershell
npm run dev -- --port 3004
```

## RC1 verification

```powershell
npm run build
npm run validate:live-db
npm run check:system
```

For the full release gate:

```powershell
npm run check:rc
```

## Documentation

- [Architecture](./Architecture.md)
- [Getting Started](./docs/Getting-Started.md)
- [Installation](./docs/Installation.md)
- [Environment](./docs/Environment.md)
- [Deployment](./docs/Deployment.md)
- [Telegram Setup](./docs/Telegram-Setup.md)
- [AI Setup](./docs/AI-Setup.md)
- [Roadmap](./docs/Roadmap.md)
- [Contributing](./CONTRIBUTING.md)
- [Release Checklist](./RELEASE_CHECKLIST.md)

## Core URLs

- Landing: `/`
- Dashboard: `/dashboard`
- Clients: `/clients`
- Deals: `/deals`
- Tasks: `/tasks`
- Demo Mode: `/demo`
- Test Checklist: `/test`
- Workboard: `/workboard`
- Deals: `/leads`
- Appointments: `/appointments`

## Core APIs

- `/api/system/health`
- `/api/telegram/analytics/track`
- `/api/dashboard`
- `/api/workboard`
- `/api/leads`
- `/api/core/clients`
- `/api/core/clients/{id}`
- `/api/core/deals`
- `/api/core/deals/{id}`
- `/api/core/summaries`
- `/api/core/statistics`
- `/api/ai/crm/summary`
- `/api/ai/sales/leads/{slug}`
- `/api/telegram/webhook`
- `/api/telegram/miniapp/auth`
- `/api/telegram/miniapp/session/end`

## Release posture

BOSE RC1 is aimed at:

- GitHub publication
- investor demos
- developer onboarding
- first live users
- Telegram Mini App launch readiness

This is not a greenfield framework.  
It is the hardened release candidate of the current working system.
