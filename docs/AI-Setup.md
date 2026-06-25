# AI Setup

BOSE RC1 ships with a unified AI service.

## Current agents

- AI Sales Assistant
- AI CRM Assistant

## Required variables

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Current endpoints

- `/api/ai/sales/leads/{slug}`
- `/api/ai/crm/summary`

## Fallback behavior

If `OPENAI_API_KEY` is not configured:

- Sales Assistant falls back to safe local reply and qualification heuristics
- CRM Assistant falls back to safe local digest and workload heuristics

This keeps BOSE usable even when AI is not enabled yet.
