create table if not exists lead_conversations (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid not null references leads(id) on delete cascade,
    channel text not null check (channel in ('telegram', 'instagram', 'youtube', 'site', 'other')),
    external_chat_id text not null,
    started_at timestamptz not null default now(),
    last_message_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (channel, external_chat_id)
);

create table if not exists lead_messages (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid not null references leads(id) on delete cascade,
    conversation_id uuid not null references lead_conversations(id) on delete cascade,
    direction text not null check (direction in ('inbound', 'outbound', 'system')),
    sender_type text not null check (sender_type in ('lead', 'manager', 'bot', 'system')),
    external_message_id text,
    message_text text,
    raw_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_lead_conversations_lead_id on lead_conversations(lead_id);
create index if not exists idx_lead_conversations_last_message_at on lead_conversations(last_message_at desc);
create index if not exists idx_lead_messages_conversation_id on lead_messages(conversation_id, created_at desc);
create index if not exists idx_lead_messages_lead_id on lead_messages(lead_id, created_at desc);
