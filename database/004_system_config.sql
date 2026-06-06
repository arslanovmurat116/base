create table if not exists system_settings (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    setting_key text not null,
    setting_value jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, setting_key)
);

create table if not exists notification_log (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid references leads(id) on delete cascade,
    task_id uuid references tasks(id) on delete cascade,
    channel text not null check (channel in ('telegram', 'email', 'system')),
    notification_type text not null,
    recipient text,
    payload jsonb not null default '{}'::jsonb,
    sent_at timestamptz not null default now()
);

create index if not exists idx_system_settings_company_key on system_settings(company_id, setting_key);
create index if not exists idx_notification_log_lead_id on notification_log(lead_id, sent_at desc);
create index if not exists idx_notification_log_task_id on notification_log(task_id, sent_at desc);
