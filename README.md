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
Copy-Item -LiteralPath ".env.example" -Destination ".env.local"
npm install
.\start-dev.ps1
```

If port `3000` is already in use:

```powershell
npm run dev -- --port 3004
```

`start-dev.ps1` does not create `.env.local` automatically.
If `.env.local` is missing, it stops with a clear error and prints the exact `Copy-Item` command to create it from `.env.example`.

## RC1 verification

```powershell
npm run check:system
```

`check:launch-config` reads configuration in this order:

1. already injected `process.env`
2. `.env.local` loaded via the standard Next env loader as a local fallback

`.env.example` is a template only, not a live configuration source.

Static release gate:

```powershell
npm run check:rc:static
```

Runtime release gate against an already running built runtime:

```powershell
npm run check:rc:runtime -- --base-url http://127.0.0.1:3100
```

Full RC flow:

1. `npm run check:rc:static`
2. start the freshly built runtime with `npm run start -- --hostname 127.0.0.1 --port 3100`
3. `npm run check:rc:runtime -- --base-url http://127.0.0.1:3100`

`npm run check:rc` runs the static gate first and then requires an explicit runtime URL.
It does not silently probe a random previously running dev server.

Mock mode is never release-ready, even if the HTTP endpoint is reachable.

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
- Scenario Request: `/scenario-request`
- Scenario Drafts: `/scenario-drafts`
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

`/api/system/health` now returns these core fields:

- `ok`: endpoint and the minimum runtime health contract are available
- `status`: `ok`, `warn`, or `error`
- `mode`: `live`, `mock`, `degraded`, or `misconfigured`
- `ready`: `true` only for release-ready live mode
- `database`
- `telegram`
- `warnings`
- `timestamp`

Health mode semantics:

- `live`: real configuration is present, live database is healthy, Telegram launch prerequisites are configured, `ok: true`, `ready: true`
- `mock`: BOSE is reachable but using mock or fallback data, `ok: true`, `ready: false`
- `degraded`: the endpoint is up but a required runtime dependency or launch prerequisite is failing; `ready: false`
- `misconfigured`: required core configuration is missing; `ok: false`, `ready: false`

HTTP contract for `/api/system/health`:

- `live` with `ready: true` returns HTTP `200`
- `mock` returns HTTP `503`
- `degraded` returns HTTP `503`
- `misconfigured` returns HTTP `503`
- an internal health-check failure returns HTTP `500`

## Scenario orders

Telegram user flow:

1. Send `/scenario` to the BOSE bot.
2. Open the Mini App button for `/scenario-request`.
3. Fill in the title, description, category, target platform, and constraints.
4. BOSE stores the request with the verified Telegram Mini App session identity.

Owner flow:

1. Open `/scenario-drafts` in owner mode.
2. Review the request, update the status, and export it for WorkHub.
3. The export button downloads a WorkHub-compatible JSON file.

## Release posture

BOSE RC1 is aimed at:

- GitHub publication
- investor demos
- developer onboarding
- first live users
- Telegram Mini App launch readiness

This is not a greenfield framework.  
It is the hardened release candidate of the current working system.
