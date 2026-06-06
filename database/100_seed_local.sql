insert into companies (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Mebel RDN')
on conflict (id) do update
set name = excluded.name;

insert into users (id, company_id, full_name, role, telegram_username, is_active)
values
    ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Мурат', 'owner', 'murat_rdn', true),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Айдана', 'manager', 'aidana_rdn', true),
    ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Тимур', 'manager', 'timur_rdn', true),
    ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'Ерлан', 'operator', 'erlan_measure', true)
on conflict (id) do update
set
    company_id = excluded.company_id,
    full_name = excluded.full_name,
    role = excluded.role,
    telegram_username = excluded.telegram_username,
    is_active = excluded.is_active;

insert into system_settings (company_id, setting_key, setting_value)
values
    ('11111111-1111-1111-1111-111111111111', 'lead_assignment_mode', '{"mode":"round_robin_manager"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111', 'telegram_notifications', '{"team_chat_id":"replace_me","timezone":"Asia/Almaty"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111', 'sla_rules', '{"first_response_minutes":15,"measurement_confirmation_minutes":180}'::jsonb)
on conflict (company_id, setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

insert into lead_loss_reasons (company_id, code, title, is_active)
values
    ('11111111-1111-1111-1111-111111111111', 'no_response', 'Не вышли на связь', true),
    ('11111111-1111-1111-1111-111111111111', 'too_expensive', 'Не устроила стоимость', true),
    ('11111111-1111-1111-1111-111111111111', 'postponed', 'Отложили ремонт или переезд', true),
    ('11111111-1111-1111-1111-111111111111', 'competitor', 'Выбрали другой цех', true),
    ('11111111-1111-1111-1111-111111111111', 'wrong_product', 'Не наш профиль заказа', true),
    ('11111111-1111-1111-1111-111111111111', 'budget_mismatch', 'Бюджет ниже ожиданий', true)
on conflict (company_id, code) do update
set title = excluded.title,
    is_active = excluded.is_active;
