create table if not exists telegram_bot_requests (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    scenario_id text not null,
    request_type text not null,
    status text not null default 'NEW',
    source_channel text not null default 'telegram',
    telegram_user_id text,
    chat_id text,
    telegram_username text,
    subject_type text not null default 'telegram_user',
    subject_id text,
    core_user_id uuid references users(id) on delete set null,
    core_client_id uuid references clients(id) on delete set null,
    related_lead_id uuid references leads(id) on delete set null,
    related_deal_id uuid references deals(id) on delete set null,
    title text not null,
    content text,
    ai_summary text,
    ai_next_action text,
    task_id uuid references tasks(id) on delete set null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_telegram_bot_requests_company_created
    on telegram_bot_requests(company_id, created_at desc);

create index if not exists idx_telegram_bot_requests_company_type
    on telegram_bot_requests(company_id, request_type, created_at desc);

create index if not exists idx_telegram_bot_requests_telegram_user
    on telegram_bot_requests(telegram_user_id, created_at desc);
