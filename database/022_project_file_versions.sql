begin;

alter table telegram_client_leads add column if not exists source_ref text;
create unique index if not exists idx_telegram_client_leads_source_ref
  on telegram_client_leads(company_id, source_ref) where source_ref is not null;

create table if not exists project_file_versions (
  id uuid primary key,
  company_id uuid not null references companies(id),
  lead_id uuid not null references leads(id),
  group_key text not null,
  version integer not null check (version > 0),
  is_current boolean not null default true,
  source_ref text not null,
  file_name text not null,
  content_type text not null,
  byte_size bigint check (byte_size > 0),
  kind text not null check (kind in ('document', 'photo')),
  storage_path text not null,
  telegram_file_id text,
  telegram_media_type text check (telegram_media_type in ('document', 'photo')),
  uploaded_by text not null,
  uploaded_by_telegram_id text,
  created_at timestamptz not null default now(),
  unique(company_id, lead_id, group_key, version),
  unique(company_id, lead_id, source_ref)
);
create unique index if not exists idx_project_file_current
  on project_file_versions(company_id, lead_id, group_key) where is_current;
create index if not exists idx_project_file_history
  on project_file_versions(company_id, lead_id, created_at desc);

commit;
