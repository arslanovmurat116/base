create table if not exists telegram_update_offsets (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    consumer_key text not null,
    offset_value bigint not null default 0,
    updated_at timestamptz not null default now(),
    unique (company_id, consumer_key)
);

create index if not exists idx_telegram_update_offsets_company_updated
    on telegram_update_offsets(company_id, updated_at desc);
