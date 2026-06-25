# Telegram Setup

## Required variables

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_SECRET_TOKEN`
- `APP_BASE_URL`

## Useful commands

```powershell
npm run telegram:me
npm run telegram:commands:set
npm run telegram:webhook:info
npm run telegram:webhook:set
```

## Main routes

- Webhook: `/api/telegram/webhook`
- Mini App auth: `/api/telegram/miniapp/auth`

## Manual checks

- `/start`
- `/register manager <name>`
- `/today`
- `/request`
- Mini App open from the bot
