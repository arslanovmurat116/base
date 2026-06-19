create table if not exists telegram_subscribers (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    chat_id text not null,
    role text not null check (role in ('director', 'manager', 'measurer')),
    full_name text,
    telegram_username text,
    telegram_user_id text,
    source text not null default 'postgres',
    registered_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    unique (company_id, chat_id, role)
);

create table if not exists telegram_client_leads (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid not null references leads(id) on delete cascade,
    external_chat_id text,
    telegram_user_id text,
    telegram_username text,
    client_name text not null,
    phone text not null,
    product text not null,
    note text,
    source_label text,
    raw_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_telegram_subscribers_company_chat
    on telegram_subscribers(company_id, chat_id, role);

create index if not exists idx_telegram_subscribers_company_role
    on telegram_subscribers(company_id, role, last_seen_at desc);

create index if not exists idx_telegram_client_leads_company_chat
    on telegram_client_leads(company_id, external_chat_id, created_at desc);

create index if not exists idx_telegram_client_leads_company_phone
    on telegram_client_leads(company_id, phone, created_at desc);

create index if not exists idx_telegram_client_leads_company_lead
    on telegram_client_leads(company_id, lead_id, created_at desc);
