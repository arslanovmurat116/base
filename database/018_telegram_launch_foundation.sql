create table if not exists telegram_identities (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    subject_type text not null default 'telegram_user',
    subject_id text,
    core_user_id uuid references users(id) on delete set null,
    core_client_id uuid references clients(id) on delete set null,
    telegram_user_id text not null,
    chat_id text,
    telegram_username text,
    first_name text,
    last_name text,
    language_code text,
    is_premium boolean not null default false,
    bot_started_at timestamptz,
    miniapp_started_at timestamptz,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    first_start_at timestamptz,
    last_start_at timestamptz,
    first_open_at timestamptz,
    last_open_at timestamptz,
    launch_count integer not null default 0,
    session_count integer not null default 0,
    active_days_count integer not null default 0,
    last_active_day date,
    last_activity_at timestamptz,
    last_activity_kind text,
    retention_state text not null default 'new',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, telegram_user_id)
);

alter table miniapp_sessions
    add column if not exists profile_id uuid references telegram_identities(id) on delete set null,
    add column if not exists started_at timestamptz not null default now(),
    add column if not exists ended_at timestamptz,
    add column if not exists duration_seconds integer,
    add column if not exists device text,
    add column if not exists platform text,
    add column if not exists telegram_version text,
    add column if not exists init_data_hash text,
    add column if not exists app_version text,
    add column if not exists language_code text,
    add column if not exists screen_path text,
    add column if not exists chat_id text,
    add column if not exists session_status text not null default 'ACTIVE';

update miniapp_sessions
set started_at = coalesce(started_at, issued_at, now()),
    session_status = coalesce(session_status, 'ACTIVE')
where started_at is null
   or session_status is null;

create table if not exists telegram_analytics_events (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    profile_id uuid references telegram_identities(id) on delete set null,
    session_id uuid references miniapp_sessions(id) on delete set null,
    subject_type text,
    subject_id text,
    user_id uuid references users(id) on delete set null,
    client_id uuid references clients(id) on delete set null,
    lead_id uuid references leads(id) on delete set null,
    deal_id uuid references deals(id) on delete set null,
    telegram_user_id text,
    chat_id text,
    username text,
    language_code text,
    platform text,
    app_version text,
    event_name text not null,
    event_at timestamptz not null default now(),
    event_key text,
    event_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (company_id, event_key)
);

create index if not exists idx_telegram_identities_company_seen
    on telegram_identities(company_id, last_seen_at desc);
create index if not exists idx_telegram_identities_company_chat
    on telegram_identities(company_id, chat_id);
create index if not exists idx_telegram_identities_company_username
    on telegram_identities(company_id, lower(coalesce(telegram_username, '')));
create index if not exists idx_miniapp_sessions_company_started
    on miniapp_sessions(company_id, started_at desc);
create index if not exists idx_miniapp_sessions_profile
    on miniapp_sessions(profile_id, started_at desc);
create index if not exists idx_telegram_analytics_events_company_name
    on telegram_analytics_events(company_id, event_name, event_at desc);
create index if not exists idx_telegram_analytics_events_session
    on telegram_analytics_events(session_id, event_at desc);
create index if not exists idx_telegram_analytics_events_profile
    on telegram_analytics_events(profile_id, event_at desc);
