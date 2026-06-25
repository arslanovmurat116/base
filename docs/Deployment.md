# Deployment

BOSE RC1 is currently prepared for Vercel deployment.

## Recommended flow

1. Set environment variables in Vercel.
2. Run live DB bootstrap once.
3. Run live DB validation.
4. Confirm webhook and health routes.
5. Redeploy after schema/runtime changes.

## Verification endpoints

- `/api/system/health`
- `/api/dashboard`
- `/api/workboard`
- `/api/leads`
- `/api/core/clients`
- `/api/core/deals`
- `/api/telegram/webhook`

## Pre-release commands

```powershell
npm run build
npm run validate:live-db
npm run check:system
```
