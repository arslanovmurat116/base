create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_leads_set_updated_at on leads;
create trigger trg_leads_set_updated_at
before update on leads
for each row
execute function set_updated_at();

create or replace view active_leads_queue as
select
    l.id,
    l.company_id,
    l.assigned_user_id,
    l.full_name,
    l.phone,
    l.telegram_username,
    l.source,
    l.channel,
    l.status,
    l.first_response_due_at,
    l.created_at,
    case
        when l.first_response_due_at is not null and l.first_response_due_at < now() and l.status = 'NEW' then true
        else false
    end as is_first_response_overdue
from leads l
where l.status not in ('WON', 'LOST');

create or replace view overdue_tasks_queue as
select
    t.id,
    t.company_id,
    t.lead_id,
    t.assigned_user_id,
    t.title,
    t.priority,
    t.due_at,
    t.status,
    now() - t.due_at as overdue_by
from tasks t
where t.status = 'OPEN'
  and t.due_at is not null
  and t.due_at < now();

create or replace view daily_pipeline_summary as
select
    l.company_id,
    date_trunc('day', l.created_at)::date as report_date,
    count(*) as total_new_leads,
    count(*) filter (where l.status = 'WON') as total_won_leads,
    count(*) filter (where l.status = 'LOST') as total_lost_leads,
    count(*) filter (where l.status = 'NEW') as total_new_status,
    count(*) filter (where l.status = 'CONTACTED') as total_contacted,
    count(*) filter (where l.status = 'QUALIFIED') as total_qualified,
    count(*) filter (where l.status = 'MEETING') as total_meeting,
    count(*) filter (where l.status = 'PROPOSAL') as total_proposal
from leads l
group by l.company_id, date_trunc('day', l.created_at)::date;
