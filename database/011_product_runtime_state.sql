create table if not exists product_pilot_requests (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    runtime_id text not null,
    request_number text not null,
    status text not null default 'NEW',
    workshop_name text,
    telegram_chat_id text,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, runtime_id),
    unique (company_id, request_number)
);

create table if not exists product_launch_handoffs (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    runtime_id text not null,
    launch_number text not null,
    pilot_request_id text,
    status text not null default 'KICKOFF_PENDING',
    workshop_name text,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, runtime_id),
    unique (company_id, launch_number)
);

create table if not exists customer_success_loops (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    runtime_id text not null,
    success_number text not null,
    launch_id text,
    status text not null default 'FIRST_WEEK',
    workshop_name text,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, runtime_id),
    unique (company_id, success_number)
);

create index if not exists idx_product_pilot_requests_company_status
    on product_pilot_requests(company_id, status, updated_at desc);

create index if not exists idx_product_pilot_requests_company_chat
    on product_pilot_requests(company_id, telegram_chat_id, updated_at desc);

create index if not exists idx_product_launch_handoffs_company_status
    on product_launch_handoffs(company_id, status, updated_at desc);

create index if not exists idx_product_launch_handoffs_company_pilot
    on product_launch_handoffs(company_id, pilot_request_id, updated_at desc);

create index if not exists idx_customer_success_loops_company_status
    on customer_success_loops(company_id, status, updated_at desc);

create index if not exists idx_customer_success_loops_company_launch
    on customer_success_loops(company_id, launch_id, updated_at desc);
