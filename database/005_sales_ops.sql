create table if not exists lead_loss_reasons (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    code text not null,
    title text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    unique (company_id, code)
);

create table if not exists lead_followups (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid not null references leads(id) on delete cascade,
    assigned_user_id uuid references users(id) on delete set null,
    followup_type text not null check (followup_type in ('call', 'message', 'meeting', 'proposal', 'custom')),
    status text not null check (status in ('PENDING', 'DONE', 'CANCELLED')) default 'PENDING',
    scheduled_at timestamptz not null,
    notes text,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

create table if not exists lead_status_history (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid not null references leads(id) on delete cascade,
    previous_status text,
    next_status text not null,
    changed_by_user_id uuid references users(id) on delete set null,
    change_reason text,
    created_at timestamptz not null default now()
);

create index if not exists idx_lead_followups_lead_id on lead_followups(lead_id, scheduled_at desc);
create index if not exists idx_lead_followups_status on lead_followups(status, scheduled_at);
create index if not exists idx_lead_status_history_lead_id on lead_status_history(lead_id, created_at desc);
