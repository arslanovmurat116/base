# Contributing to BOSE

## Principles

- do not rewrite working flows when a safe extension is enough
- preserve backward compatibility for live Telegram and lead flows
- keep BOSE core generic and keep Furneq-specific behavior isolated
- prefer Postgres as the source of truth
- verify runtime, not only build output

## Local workflow

```powershell
npm install
npm run build
npm run validate:live-db
npm run check:system
```

## Change policy

- small, reviewable changes
- keep public API contracts backward compatible unless explicitly versioned
- add migrations instead of destructive schema edits
- update docs when behavior changes

## Release mindset

BOSE RC1 is prepared for first users and public GitHub visibility.  
Treat stability, explainability, and safe defaults as product features.
