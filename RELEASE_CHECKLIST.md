# BOSE RC1 Release Checklist

## Code and build

- [ ] `npm install`
- [ ] `npm run build`
- [ ] `npm run validate:live-db`
- [ ] `npm run check:system`

## Database

- [ ] bootstrap migrations applied
- [ ] validation counts are sane
- [ ] `clients`, `deals`, and `business_events` are populated
- [ ] no critical lead flow regressed

## Telegram

- [ ] bot token configured
- [ ] webhook configured
- [ ] secret token configured
- [ ] `/register`, `/today`, `/start`, `/request` checked
- [ ] Mini App auth route checked

## AI

- [ ] `OPENAI_API_KEY` configured or fallback mode accepted
- [ ] `/api/ai/crm/summary` checked
- [ ] `/api/ai/sales/leads/{slug}` checked

## UI

- [ ] landing opens
- [ ] `/dashboard` opens
- [ ] `/workboard` opens
- [ ] `/leads` opens
- [ ] `/appointments` opens

## Repository

- [ ] README updated
- [ ] Architecture.md updated
- [ ] `.env.example` present
- [ ] LICENSE present
- [ ] docs linked from README

## Production

- [ ] environment variables set
- [ ] Vercel build succeeds
- [ ] live API smoke passes
- [ ] health route returns healthy state
