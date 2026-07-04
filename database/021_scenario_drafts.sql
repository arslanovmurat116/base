create table if not exists scenario_drafts (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    source text not null,
    telegram_user_id text,
    telegram_username text,
    chat_id text,
    session_id uuid references miniapp_sessions(id) on delete set null,
    title text not null,
    description text not null,
    category text not null,
    target_platform text not null default 'other',
    constraints_json jsonb not null default '[]'::jsonb,
    raw_text text not null,
    ai_summary text,
    suggested_trigger text,
    suggested_steps_json jsonb not null default '[]'::jsonb,
    suggested_entities_json jsonb not null default '[]'::jsonb,
    suggested_bot_actions_json jsonb not null default '[]'::jsonb,
    suggested_miniapp_blocks_json jsonb not null default '[]'::jsonb,
    status text not null default 'NEW',
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table scenario_drafts
    add column if not exists telegram_username text;

alter table scenario_drafts
    add column if not exists title text;

alter table scenario_drafts
    add column if not exists description text;

alter table scenario_drafts
    add column if not exists target_platform text;

alter table scenario_drafts
    add column if not exists constraints_json jsonb not null default '[]'::jsonb;

alter table scenario_drafts
    add column if not exists metadata_json jsonb not null default '{}'::jsonb;

update scenario_drafts
set
    title = coalesce(nullif(title, ''), left(coalesce(ai_summary, raw_text, 'Scenario request'), 140)),
    description = coalesce(nullif(description, ''), raw_text),
    target_platform = coalesce(nullif(target_platform, ''), 'other'),
    status = case
        when upper(status) in ('NEW', 'REVIEW', 'EXPORTED', 'PROCESSING', 'READY', 'REJECTED') then upper(status)
        when lower(status) = 'draft' then 'NEW'
        else coalesce(nullif(upper(status), ''), 'NEW')
    end
where
    title is null
    or title = ''
    or description is null
    or description = ''
    or target_platform is null
    or target_platform = ''
    or status !~ '^(NEW|REVIEW|EXPORTED|PROCESSING|READY|REJECTED)$';

alter table scenario_drafts
    alter column title set not null;

alter table scenario_drafts
    alter column description set not null;

alter table scenario_drafts
    alter column target_platform set default 'other';

alter table scenario_drafts
    alter column target_platform set not null;

alter table scenario_drafts
    alter column status set default 'NEW';

create index if not exists idx_scenario_drafts_company_created_at
    on scenario_drafts(company_id, created_at desc);

create index if not exists idx_scenario_drafts_company_status
    on scenario_drafts(company_id, status, updated_at desc);

create index if not exists idx_scenario_drafts_company_telegram_user
    on scenario_drafts(company_id, telegram_user_id, updated_at desc);

create index if not exists idx_scenario_drafts_company_session
    on scenario_drafts(company_id, session_id, updated_at desc);
