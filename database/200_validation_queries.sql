select 'companies' as entity, count(*) as total from companies
union all
select 'users', count(*) from users
union all
select 'leads', count(*) from leads
union all
select 'tasks', count(*) from tasks
union all
select 'lead_conversations', count(*) from lead_conversations
union all
select 'lead_messages', count(*) from lead_messages
union all
select 'lead_events', count(*) from lead_events
union all
select 'telegram_subscribers', count(*) from telegram_subscribers
union all
select 'telegram_client_leads', count(*) from telegram_client_leads
union all
select 'product_pilot_requests', count(*) from product_pilot_requests
union all
select 'product_launch_handoffs', count(*) from product_launch_handoffs
union all
select 'customer_success_loops', count(*) from customer_success_loops
union all
select 'lead_runtime_patches', count(*) from lead_runtime_patches
union all
select 'telegram_registration_states', count(*) from telegram_registration_states
union all
select 'telegram_dispatch_logs', count(*) from telegram_dispatch_logs
union all
select 'telegram_update_offsets', count(*) from telegram_update_offsets
union all
select 'roles', count(*) from roles
union all
select 'user_roles', count(*) from user_roles
union all
select 'clients', count(*) from clients
union all
select 'deals', count(*) from deals
union all
select 'business_events', count(*) from business_events
union all
select 'miniapp_sessions', count(*) from miniapp_sessions
union all
select 'telegram_identities', count(*) from telegram_identities
union all
select 'telegram_analytics_events', count(*) from telegram_analytics_events
union all
select 'telegram_bot_requests', count(*) from telegram_bot_requests
union all
select 'daily_reports', count(*) from daily_reports;

select id, full_name, source, channel, status, assigned_user_id, created_at
from leads
order by created_at desc
limit 20;

select id, lead_id, title, status, priority, due_at
from tasks
order by created_at desc
limit 20;

select lead_id, event_type, created_at
from lead_events
order by created_at desc
limit 50;

select
    l.id,
    l.full_name,
    l.status,
    l.created_at
from leads l
left join deals d
    on d.company_id = l.company_id
   and d.lead_id = l.id
where d.id is null
order by l.created_at desc
limit 50;

select conversation_id, sender_type, direction, created_at, message_text
from lead_messages
order by created_at desc
limit 50;
