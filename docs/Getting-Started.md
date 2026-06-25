# Getting Started

1. Copy `.env.example` to `.env.local`.
2. Fill in your Postgres and Telegram values.
3. Install dependencies.
4. Bootstrap the database if needed.
5. Start the app and run the system checks.

```powershell
npm install
npm run bootstrap:live-db
npm run validate:live-db
npm run dev
```

Useful checks:

```powershell
npm run build
npm run check:system
```
