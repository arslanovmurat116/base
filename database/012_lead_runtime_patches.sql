create table if not exists lead_runtime_patches (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    lead_id text not null,
    patch jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, lead_id)
);

create index if not exists idx_lead_runtime_patches_company_updated
    on lead_runtime_patches(company_id, updated_at desc);
