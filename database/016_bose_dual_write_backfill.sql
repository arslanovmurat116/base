create unique index if not exists idx_clients_company_source_lead_unique
    on clients(company_id, source_lead_id);

create unique index if not exists idx_deals_company_lead_unique
    on deals(company_id, lead_id);

insert into clients (
    company_id,
    source_lead_id,
    owner_user_id,
    display_name,
    primary_phone,
    telegram_username,
    status,
    notes,
    created_at,
    updated_at
)
select
    l.company_id,
    l.id,
    l.assigned_user_id,
    coalesce(nullif(l.full_name, ''), nullif(l.telegram_username, ''), 'Client'),
    nullif(l.phone, ''),
    nullif(l.telegram_username, ''),
    case
        when l.status = 'WON' then 'ACTIVE'
        when l.status = 'LOST' then 'INACTIVE'
        else 'PROSPECT'
    end,
    l.notes,
    l.created_at,
    l.updated_at
from leads l
where not exists (
    select 1
    from clients c
    where c.company_id = l.company_id
      and (
        c.source_lead_id = l.id
        or (
            l.phone is not null
            and l.phone <> ''
            and c.primary_phone = l.phone
        )
        or (
            l.telegram_username is not null
            and l.telegram_username <> ''
            and lower(coalesce(c.telegram_username, '')) = lower(l.telegram_username)
        )
      )
);

update clients c
set
    source_lead_id = coalesce(c.source_lead_id, l.id),
    owner_user_id = coalesce(c.owner_user_id, l.assigned_user_id),
    updated_at = now()
from leads l
where c.company_id = l.company_id
  and c.source_lead_id is null
  and (
    (l.phone is not null and l.phone <> '' and c.primary_phone = l.phone)
    or (
      l.telegram_username is not null
      and l.telegram_username <> ''
      and lower(coalesce(c.telegram_username, '')) = lower(l.telegram_username)
    )
  );

insert into deals (
    company_id,
    lead_id,
    client_id,
    owner_user_id,
    title,
    pipeline_key,
    stage_key,
    status,
    payload,
    created_at,
    updated_at
)
select
    l.company_id,
    l.id,
    c.id,
    l.assigned_user_id,
    concat(
        coalesce(nullif(l.full_name, ''), 'Lead'),
        ' · ',
        coalesce(nullif(l.source, ''), 'New business case')
    ),
    'sales',
    case
        when l.status = 'CONTACTED' then 'contacted'
        when l.status = 'QUALIFIED' then 'qualified'
        when l.status = 'MEETING' then 'appointment'
        when l.status = 'PROPOSAL' then 'proposal'
        when l.status = 'WON' then 'won'
        when l.status = 'LOST' then 'lost'
        else 'new'
    end,
    case
        when l.status = 'WON' then 'CLOSED_WON'
        when l.status = 'LOST' then 'CLOSED_LOST'
        else 'OPEN'
    end,
    jsonb_build_object(
        'backfilled', true,
        'source', l.source,
        'channel', l.channel,
        'status', l.status
    ),
    l.created_at,
    l.updated_at
from leads l
left join clients c
    on c.company_id = l.company_id
   and c.source_lead_id = l.id
where not exists (
    select 1
    from deals d
    where d.company_id = l.company_id
      and d.lead_id = l.id
);

insert into business_events (
    company_id,
    aggregate_type,
    aggregate_id,
    event_name,
    event_version,
    actor_type,
    payload,
    occurred_at,
    created_at
)
select
    l.company_id,
    'lead',
    l.id::text,
    'LeadCreated',
    1,
    'system',
    jsonb_build_object(
        'backfilled', true,
        'source', l.source,
        'channel', l.channel,
        'status', l.status
    ),
    l.created_at,
    now()
from leads l
where not exists (
    select 1
    from business_events e
    where e.company_id = l.company_id
      and e.aggregate_type = 'lead'
      and e.aggregate_id = l.id::text
      and e.event_name = 'LeadCreated'
);

insert into business_events (
    company_id,
    aggregate_type,
    aggregate_id,
    event_name,
    event_version,
    actor_type,
    payload,
    occurred_at,
    created_at
)
select
    c.company_id,
    'client',
    c.id::text,
    'ClientCreated',
    1,
    'system',
    jsonb_build_object(
        'backfilled', true,
        'sourceLeadId', c.source_lead_id
    ),
    c.created_at,
    now()
from clients c
where not exists (
    select 1
    from business_events e
    where e.company_id = c.company_id
      and e.aggregate_type = 'client'
      and e.aggregate_id = c.id::text
      and e.event_name = 'ClientCreated'
);

insert into business_events (
    company_id,
    aggregate_type,
    aggregate_id,
    event_name,
    event_version,
    actor_type,
    payload,
    occurred_at,
    created_at
)
select
    d.company_id,
    'deal',
    d.id::text,
    'DealCreated',
    1,
    'system',
    jsonb_build_object(
        'backfilled', true,
        'leadId', d.lead_id,
        'clientId', d.client_id,
        'stageKey', d.stage_key
    ),
    d.created_at,
    now()
from deals d
where not exists (
    select 1
    from business_events e
    where e.company_id = d.company_id
      and e.aggregate_type = 'deal'
      and e.aggregate_id = d.id::text
      and e.event_name = 'DealCreated'
);
