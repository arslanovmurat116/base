# BOSE Bot Scenario Inventory

Safe scenario import audit for BOSE Bot. The goal is to adapt patterns, not copy external repos into BOSE.

## Sources analyzed

- [TeleBotList](https://github.com/MoonWalker440/TeleBotList)
- [awesome-telegram-bots](https://github.com/DenisIzmaylov/awesome-telegram-bots)
- [aiogram FSM docs](https://docs.aiogram.dev/en/latest/dispatcher/finite_state_machine/index.html)
- [python-telegram-bot ConversationHandler docs](https://docs.python-telegram-bot.org/en/stable/telegram.ext.conversationhandler.html)
- [Telegraf docs](https://telegraf.js.org/)
- [grammY docs](https://grammy.dev/)
- [n8n Telegram integration](https://n8n.io/integrations/telegram/)
- [n8n Telegram node docs](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.telegram/)
- [awesome n8n templates](https://github.com/enescingoz/awesome-n8n-templates)
- [NetherlandsIT n8n Examples](https://github.com/NetherlandsIT/n8n-Examples)

## Safe patterns extracted

- Multi-step stateful conversations with explicit step memory.
- Inline button menus for start, confirm, cancel, and follow-up actions.
- Command routing layered with text-intent fallback.
- Lead and support intake as guided flows instead of free-form chaos.
- AI as assistive summary/draft layer, not autonomous mutation layer.
- File/document intake as metadata capture plus routing task.
- Digest and alert scenarios built from existing CRM read models.

## Scenario inventory

| Scenario | Source pattern | What it does | BOSE value | Complexity | Risk | Priority | BOSE integration |
|---|---|---|---|---|---|---|---|
| Create Client | FSM + lead capture | Creates first-class client | High | Low | Low | P1 | Clients, Events, Analytics |
| Create Deal | CRM bot workflows | Creates deal for existing client | High | Low | Low | P1 | Deals, Clients, Events |
| Create Task | Admin task bots | Creates task with optional reference | High | Low | Low | P1 | Tasks, Lead compatibility |
| Follow-up Reminder | Reminder bots | Creates timed follow-up | High | Low | Low | P1 | Followups, Notifications |
| Ask AI | FAQ/support + OpenAI assist | Gives summary, next step, scenario hint | High | Low | Low | P1 | AI, Dashboard, Analytics |
| Daily Summary | Digest bots | Returns AI CRM daily summary | High | Low | Low | P1 | Dashboard, Tasks, Followups |
| Customer Feedback | Support/product intake | Captures what feels missing | High | Low | Low | P1 | Tasks, Bot Requests, Events |
| Feature Request | Product discovery intake | Captures feature/automation demand | High | Low | Low | P1 | Tasks, Bot Requests, Events |
| Support Request | Support desk bots | Captures issue and routes it | High | Low | Low | P1 | Tasks, Bot Requests, Events |
| File/Document Intake | Telegram document workflows | Captures uploaded file metadata | Medium | Medium | Low | P2 | Tasks, Bot Requests, Events |

## Implemented MVP scenarios

- `create_client`
- `create_deal`
- `create_task`
- `followup_reminder`
- `ask_ai`
- `daily_summary`
- `customer_feedback`
- `feature_request`
- `support_request`
- `file_document_intake`

## BOSE registry shape

- `scenario id`
- `command`
- `trigger`
- `required input`
- `steps`
- `handler`
- `AI usage`
- `business event`
- `result message`

## Safety rules used

- No external code copied into BOSE.
- No new heavy dependencies.
- No framework migration.
- Existing Telegram webhook stays intact.
- Scenario writes go through BOSE entities: Clients, Deals, Tasks, Followups, Business Events, Analytics.
- Risky create flows require explicit confirm/cancel before mutation.
