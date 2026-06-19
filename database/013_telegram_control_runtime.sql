create table if not exists telegram_registration_states (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    chat_id text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, chat_id)
);

create table if not exists telegram_dispatch_logs (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    dispatch_key text not null,
    sent_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, dispatch_key)
);

create index if not exists idx_telegram_registration_states_company_updated
    on telegram_registration_states(company_id, updated_at desc);

create index if not exists idx_telegram_dispatch_logs_company_updated
    on telegram_dispatch_logs(company_id, updated_at desc);
