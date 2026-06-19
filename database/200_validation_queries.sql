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

select conversation_id, sender_type, direction, created_at, message_text
from lead_messages
order by created_at desc
limit 50;
