create index if not exists idx_leads_company_created_at
    on leads(company_id, created_at desc);

create index if not exists idx_tasks_company_lead_status_due_at
    on tasks(company_id, lead_id, status, due_at, created_at desc);

create index if not exists idx_followups_company_lead_status_scheduled_at
    on lead_followups(company_id, lead_id, status, scheduled_at, created_at desc);

create index if not exists idx_messages_lead_created_at
    on lead_messages(lead_id, created_at desc);

create index if not exists idx_events_company_lead_created_at
    on lead_events(company_id, lead_id, created_at desc);

create index if not exists idx_status_history_company_lead_created_at
    on lead_status_history(company_id, lead_id, created_at desc);
