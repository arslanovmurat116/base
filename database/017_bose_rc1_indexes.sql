create index if not exists idx_clients_company_phone
    on clients(company_id, primary_phone);

create index if not exists idx_clients_company_telegram_user
    on clients(company_id, telegram_user_id);

create index if not exists idx_clients_company_telegram_username_lower
    on clients(company_id, lower(coalesce(telegram_username, '')));

create index if not exists idx_deals_company_status_updated
    on deals(company_id, status, updated_at desc);

create index if not exists idx_deals_company_owner_updated
    on deals(company_id, owner_user_id, updated_at desc);

create index if not exists idx_tasks_company_status_due
    on tasks(company_id, status, due_at);

create index if not exists idx_appointments_company_status_scheduled
    on appointments(company_id, status, scheduled_at);

create index if not exists idx_miniapp_sessions_subject
    on miniapp_sessions(company_id, subject_type, subject_id, expires_at desc);
