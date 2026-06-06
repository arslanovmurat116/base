create extension if not exists "pgcrypto";

create table if not exists companies (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz not null default now()
);

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    full_name text not null,
    role text not null check (role in ('owner', 'manager', 'operator')),
    telegram_username text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists leads (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    assigned_user_id uuid references users(id) on delete set null,
    full_name text,
    phone text,
    telegram_username text,
    source text not null,
    channel text not null,
    campaign_name text,
    ad_name text,
    creative_name text,
    landing_name text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    status text not null check (status in ('NEW', 'CONTACTED', 'QUALIFIED', 'MEETING', 'PROPOSAL', 'WON', 'LOST')) default 'NEW',
    temperature text check (temperature in ('cold', 'warm', 'hot')),
    lead_cost numeric(12,2),
    notes text,
    first_response_due_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists tasks (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid references leads(id) on delete cascade,
    assigned_user_id uuid references users(id) on delete set null,
    title text not null,
    description text,
    status text not null check (status in ('OPEN', 'DONE', 'CANCELLED')) default 'OPEN',
    priority text not null check (priority in ('low', 'medium', 'high')) default 'medium',
    due_at timestamptz,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

create table if not exists lead_events (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid not null references leads(id) on delete cascade,
    actor_user_id uuid references users(id) on delete set null,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists daily_reports (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    report_date date not null,
    total_new_leads integer not null default 0,
    total_open_tasks integer not null default 0,
    total_overdue_tasks integer not null default 0,
    total_won_leads integer not null default 0,
    total_lost_leads integer not null default 0,
    report_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (company_id, report_date)
);

create index if not exists idx_leads_company_status on leads(company_id, status);
create index if not exists idx_leads_assigned_user on leads(assigned_user_id);
create index if not exists idx_leads_created_at on leads(created_at desc);
create index if not exists idx_tasks_assigned_status on tasks(assigned_user_id, status);
create index if not exists idx_tasks_due_at on tasks(due_at);
create index if not exists idx_lead_events_lead_created_at on lead_events(lead_id, created_at desc);
