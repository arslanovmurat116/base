create table if not exists lead_intake_sessions (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid not null references leads(id) on delete cascade,
    conversation_id uuid not null references lead_conversations(id) on delete cascade,
    channel text not null default 'telegram' check (channel in ('telegram', 'instagram', 'youtube', 'site', 'other')),
    status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    current_step text not null,
    answers jsonb not null default '{}'::jsonb,
    summary_text text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists idx_lead_intake_sessions_lead_id
    on lead_intake_sessions(lead_id, created_at desc);

create index if not exists idx_lead_intake_sessions_status
    on lead_intake_sessions(status, updated_at desc);
