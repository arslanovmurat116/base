create table if not exists roles (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    code text not null,
    name text not null,
    description text,
    scope text not null default 'company',
    permissions jsonb not null default '{}'::jsonb,
    is_system boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, code)
);

create table if not exists user_roles (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role_id uuid not null references roles(id) on delete cascade,
    assigned_at timestamptz not null default now(),
    unique (user_id, role_id)
);

create table if not exists clients (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    source_lead_id uuid references leads(id) on delete set null,
    owner_user_id uuid references users(id) on delete set null,
    display_name text not null,
    primary_phone text,
    primary_email text,
    telegram_user_id text,
    telegram_username text,
    status text not null default 'ACTIVE',
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists deals (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid references leads(id) on delete set null,
    client_id uuid references clients(id) on delete set null,
    owner_user_id uuid references users(id) on delete set null,
    title text not null,
    pipeline_key text not null default 'default',
    stage_key text not null default 'new',
    status text not null default 'OPEN',
    currency text not null default 'KZT',
    amount_estimate numeric(12,2),
    close_target_at timestamptz,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists business_events (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    aggregate_type text not null,
    aggregate_id text not null,
    event_name text not null,
    event_version integer not null default 1,
    actor_type text not null default 'system',
    actor_id text,
    channel text,
    causation_id uuid,
    correlation_id uuid,
    payload jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists miniapp_sessions (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references companies(id) on delete cascade,
    subject_type text not null,
    subject_id text not null,
    telegram_user_id text not null,
    telegram_username text,
    session_token text not null unique,
    issued_at timestamptz not null default now(),
    expires_at timestamptz not null,
    payload jsonb not null default '{}'::jsonb
);

insert into roles (company_id, code, name, description, scope, is_system)
select
    c.id,
    r.code,
    r.name,
    r.description,
    r.scope,
    true
from companies c
cross join (
    values
        ('owner', 'Owner', 'Unified owner role for BOSE web and Telegram.', 'company'),
        ('manager', 'Manager', 'Unified manager role for BOSE web and Telegram.', 'company'),
        ('operator', 'Operator', 'Unified operator role for BOSE field or execution specialists.', 'company'),
        ('client', 'Client', 'External customer role for Telegram and Mini App contexts.', 'external')
) as r(code, name, description, scope)
on conflict (company_id, code) do update
set
    name = excluded.name,
    description = excluded.description,
    scope = excluded.scope,
    is_system = excluded.is_system,
    updated_at = now();

insert into user_roles (company_id, user_id, role_id)
select
    u.company_id,
    u.id,
    r.id
from users u
join roles r
    on r.company_id = u.company_id
   and r.code = u.role
on conflict (user_id, role_id) do nothing;

create index if not exists idx_roles_company_code on roles(company_id, code);
create index if not exists idx_user_roles_company_user on user_roles(company_id, user_id);
create index if not exists idx_clients_company_owner on clients(company_id, owner_user_id);
create index if not exists idx_clients_source_lead on clients(source_lead_id);
create index if not exists idx_deals_company_stage on deals(company_id, pipeline_key, stage_key);
create index if not exists idx_deals_lead_id on deals(lead_id);
create index if not exists idx_deals_client_id on deals(client_id);
create index if not exists idx_business_events_company_aggregate on business_events(company_id, aggregate_type, aggregate_id, occurred_at desc);
create index if not exists idx_business_events_company_name on business_events(company_id, event_name, occurred_at desc);
create index if not exists idx_miniapp_sessions_telegram_user on miniapp_sessions(telegram_user_id, expires_at desc);

