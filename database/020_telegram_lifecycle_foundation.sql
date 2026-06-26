alter table telegram_identities
    add column if not exists lifecycle_stage text not null default 'new',
    add column if not exists bot_launch_count integer not null default 0,
    add column if not exists miniapp_launch_count integer not null default 0,
    add column if not exists next_reengagement_at timestamptz,
    add column if not exists reengagement_status text not null default 'idle',
    add column if not exists last_reengagement_at timestamptz;

update telegram_identities
set lifecycle_stage = coalesce(nullif(lifecycle_stage, ''), 'new'),
    bot_launch_count = greatest(coalesce(bot_launch_count, 0), case when first_start_at is not null then 1 else 0 end),
    miniapp_launch_count = greatest(coalesce(miniapp_launch_count, 0), coalesce(launch_count, 0)),
    next_reengagement_at = coalesce(next_reengagement_at, coalesce(last_seen_at, now()) + interval '1 day'),
    reengagement_status = coalesce(nullif(reengagement_status, ''), 'scheduled');

update telegram_identities
set lifecycle_stage = case
    when last_seen_at < now() - interval '30 days' then 'inactive'
    when last_seen_at < now() - interval '7 days' then 'dormant'
    when active_days_count >= 3 or session_count >= 2 or coalesce(bot_launch_count, 0) + coalesce(miniapp_launch_count, 0) >= 4 then 'engaged'
    when session_count >= 1 or coalesce(bot_launch_count, 0) + coalesce(miniapp_launch_count, 0) >= 2 then 'activated'
    else 'new'
end;

create table if not exists telegram_retention_campaigns (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    profile_id uuid not null references telegram_identities(id) on delete cascade,
    campaign_type text not null,
    lifecycle_stage text not null default 'new',
    status text not null default 'scheduled',
    scheduled_at timestamptz not null,
    last_activity_at timestamptz,
    last_evaluated_at timestamptz not null default now(),
    cooldown_until timestamptz,
    campaign_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, profile_id, campaign_type)
);

create index if not exists idx_telegram_retention_campaigns_schedule
    on telegram_retention_campaigns(company_id, status, scheduled_at asc);
create index if not exists idx_telegram_retention_campaigns_profile
    on telegram_retention_campaigns(profile_id, scheduled_at desc);

insert into telegram_retention_campaigns (
    company_id,
    profile_id,
    campaign_type,
    lifecycle_stage,
    status,
    scheduled_at,
    last_activity_at,
    last_evaluated_at,
    campaign_payload,
    updated_at
)
select
    company_id,
    id,
    campaign_type,
    lifecycle_stage,
    'scheduled',
    scheduled_at,
    last_activity_at,
    now(),
    payload::jsonb,
    now()
from (
    select
        ti.company_id,
        ti.id,
        ti.lifecycle_stage,
        ti.last_activity_at,
        'day_1_return' as campaign_type,
        coalesce(ti.last_seen_at, now()) + interval '1 day' as scheduled_at,
        json_build_object('triggerAfterDays', 1, 'kind', 'return', 'surface', 'telegram') as payload
    from telegram_identities ti
    union all
    select
        ti.company_id,
        ti.id,
        ti.lifecycle_stage,
        ti.last_activity_at,
        'day_7_return' as campaign_type,
        coalesce(ti.last_seen_at, now()) + interval '7 days' as scheduled_at,
        json_build_object('triggerAfterDays', 7, 'kind', 'return', 'surface', 'telegram') as payload
    from telegram_identities ti
    union all
    select
        ti.company_id,
        ti.id,
        ti.lifecycle_stage,
        ti.last_activity_at,
        'inactive_recovery' as campaign_type,
        coalesce(ti.last_seen_at, now()) + interval '14 days' as scheduled_at,
        json_build_object('triggerAfterDays', 14, 'kind', 'recovery', 'surface', 'telegram') as payload
    from telegram_identities ti
) seed
on conflict (company_id, profile_id, campaign_type)
do update set
    lifecycle_stage = excluded.lifecycle_stage,
    scheduled_at = excluded.scheduled_at,
    last_activity_at = excluded.last_activity_at,
    last_evaluated_at = now(),
    campaign_payload = excluded.campaign_payload,
    updated_at = now();
