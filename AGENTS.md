# BOSE Repository Instructions

## Product

BOSE is a Telegram-first Business OS with an AI layer.

Furneq is not the active product. Existing Furneq code may be reused only when it supports BOSE.

## Primary objective

Move the repository toward the first working public Telegram release.

## Required workflow

1. Inspect the current Git status before editing.
2. Do not overwrite or revert existing user changes.
3. Read relevant files before creating new abstractions.
4. Make the smallest complete change.
5. Run the narrowest relevant validation.
6. Report changed files and actual validation results.

## Existing working tree

This repository may contain uncommitted user work.

Treat all pre-existing changes as protected.

Do not:

- reset;
- clean;
- checkout over changed files;
- discard changes;
- rewrite unrelated files;
- perform broad formatting;
- perform broad refactoring.

## Release priority

1. Telegram authentication
2. User registration and persistence
3. Analytics
4. Dashboard
5. Clients
6. Deals
7. Tasks
8. Business Events
9. AI Summary
10. AI Next Action
11. AI Draft Reply
12. CRM Assistant
13. Sales Assistant
14. Telegram launch and moderation

## Restrictions

Explicit approval is required before:

- production deployment;
- database migration;
- destructive Git operation;
- changing production environment variables;
- changing domains or webhooks;
- enabling payments;
- deleting business or user data.

Real TON payments are outside the first release scope.

## Context efficiency

- Use targeted search.
- Do not scan generated folders.
- Ignore node_modules, .next, dist, build, coverage, and logs.
- Do not load unrelated project history.
- Prefer Git diff and specific files.
- Do not start subagents unless explicitly requested.

## Validation

Use existing package scripts from package.json.

Never claim that build, lint, tests, deployment, authentication, or AI functions work unless they were actually verified.
