create table if not exists appointments (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id uuid not null references leads(id) on delete cascade,
    assigned_user_id uuid references users(id) on delete set null,
    appointment_type text not null check (appointment_type in ('consultation', 'visit', 'procedure', 'meeting', 'custom')),
    status text not null check (status in ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')) default 'SCHEDULED',
    scheduled_at timestamptz not null,
    duration_minutes integer,
    location text,
    notes text,
    created_at timestamptz not null default now(),
    confirmed_at timestamptz,
    completed_at timestamptz
);

create index if not exists idx_appointments_lead_id on appointments(lead_id, scheduled_at desc);
create index if not exists idx_appointments_company_status on appointments(company_id, status, scheduled_at);
create index if not exists idx_appointments_assigned_user on appointments(assigned_user_id, scheduled_at);
