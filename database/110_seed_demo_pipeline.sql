insert into leads (
    id,
    company_id,
    assigned_user_id,
    full_name,
    phone,
    telegram_username,
    source,
    channel,
    campaign_name,
    ad_name,
    creative_name,
    landing_name,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    status,
    temperature,
    lead_cost,
    notes,
    first_response_due_at,
    created_at,
    updated_at
)
values
    (
        '33333333-3333-3333-3333-333333333331',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'Асель К.',
        '+7 747 120 43 11',
        'asel_kitchen',
        'Instagram Ads',
        'Telegram',
        'June Kitchen Flow',
        'Kitchen Reel',
        'Warm Interior Video',
        'Kitchen Landing',
        'instagram',
        'cpc',
        'june_kitchen',
        'creative_a',
        'NEW',
        'hot',
        6.40,
        'Заявка на кухню в новостройку. Важно успеть в быстрый первый контакт.',
        now() + interval '15 minutes',
        now() - interval '25 minutes',
        now() - interval '5 minutes'
    ),
    (
        '33333333-3333-3333-3333-333333333332',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222223',
        'Нурлан С.',
        '+7 705 552 19 84',
        'nurlan_hall',
        'WhatsApp',
        'Referral',
        'Referral June',
        'Referral',
        'Existing Client',
        'Direct Contact',
        'referral',
        'organic',
        'wardrobe_referral',
        'client_base',
        'CONTACTED',
        'warm',
        0.00,
        'Интересует шкаф в прихожую. Просил вернуться вечером после работы.',
        now() + interval '3 hours',
        now() - interval '5 hours',
        now() - interval '40 minutes'
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'Семья Имановых',
        '+7 777 881 00 16',
        'imanovy_family',
        'Instagram Direct',
        'Telegram',
        'Wardrobe Sprint',
        'Story CTA',
        'Storage Idea',
        'Lead Form',
        'instagram',
        'dm',
        'wardrobe_sprint',
        'story_cta',
        'MEETING',
        'hot',
        3.20,
        'Замер подтверждён. После выезда нужно быстро собрать расчёт и проект.',
        now() + interval '18 hours',
        now() - interval '1 day',
        now() - interval '1 hour'
    ),
    (
        '33333333-3333-3333-3333-333333333334',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222223',
        'Айгуль Т.',
        '+7 747 902 67 12',
        'aigul_niche',
        'Site',
        'Landing',
        'Wardrobe Landing',
        'Landing Form',
        'Built-In Niche',
        'Main Page',
        'google',
        'cpc',
        'built_in_niche',
        'search_a',
        'PROPOSAL',
        'warm',
        4.10,
        'Замер проведён, смета и проект готовы. Нужен уверенный дожим до предоплаты.',
        now() + interval '22 hours',
        now() - interval '2 days',
        now() - interval '2 hours'
    ),
    (
        '33333333-3333-3333-3333-333333333335',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'Динара М.',
        '+7 708 310 22 54',
        'dinara_island',
        'Recommendation',
        'Telegram',
        'Kitchen Referral',
        'Referral',
        'Island Kitchen',
        'Client Referral',
        'referral',
        'organic',
        'kitchen_referral',
        'client_ref',
        'WON',
        'hot',
        0.00,
        'Предоплата получена, кухня уже ушла в производство. Дальше важен контроль сборки и установки.',
        now() + interval '3 days',
        now() - interval '6 days',
        now() - interval '30 minutes'
    )
on conflict (id) do update
set
    company_id = excluded.company_id,
    assigned_user_id = excluded.assigned_user_id,
    full_name = excluded.full_name,
    phone = excluded.phone,
    telegram_username = excluded.telegram_username,
    source = excluded.source,
    channel = excluded.channel,
    campaign_name = excluded.campaign_name,
    ad_name = excluded.ad_name,
    creative_name = excluded.creative_name,
    landing_name = excluded.landing_name,
    utm_source = excluded.utm_source,
    utm_medium = excluded.utm_medium,
    utm_campaign = excluded.utm_campaign,
    utm_content = excluded.utm_content,
    status = excluded.status,
    temperature = excluded.temperature,
    lead_cost = excluded.lead_cost,
    notes = excluded.notes,
    first_response_due_at = excluded.first_response_due_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;

insert into tasks (
    id,
    company_id,
    lead_id,
    assigned_user_id,
    title,
    description,
    status,
    priority,
    due_at,
    created_at
)
values
    (
        '44444444-4444-4444-4444-444444444441',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333331',
        '22222222-2222-2222-2222-222222222222',
        'Первый контакт по кухне Асель',
        'Уточнить планировку кухни, сроки ремонта и договориться о следующем шаге.',
        'OPEN',
        'high',
        now() + interval '15 minutes',
        now() - interval '10 minutes'
    ),
    (
        '44444444-4444-4444-4444-444444444442',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333332',
        '22222222-2222-2222-2222-222222222223',
        'Вернуться по шкафу Нурлана',
        'Повторно созвониться вечером, уточнить бюджет и перейти к замеру.',
        'OPEN',
        'medium',
        now() + interval '3 hours',
        now() - interval '20 minutes'
    ),
    (
        '44444444-4444-4444-4444-444444444443',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'Подтвердить завтрашний замер',
        'Проверить, что клиент подготовил зоны для замера и доступ к объекту.',
        'OPEN',
        'high',
        now() + interval '12 hours',
        now() - interval '30 minutes'
    ),
    (
        '44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333334',
        '22222222-2222-2222-2222-222222222223',
        'Дожать после КП Айгуль',
        'Вернуться после отправки сметы и согласовать решение по предоплате.',
        'OPEN',
        'medium',
        now() + interval '22 hours',
        now() - interval '45 minutes'
    ),
    (
        '44444444-4444-4444-4444-444444444445',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333335',
        '22222222-2222-2222-2222-222222222222',
        'Согласовать окно монтажа по кухне Динары',
        'После сборки подтвердить дату установки и готовность помещения.',
        'OPEN',
        'medium',
        now() + interval '2 days',
        now() - interval '1 hour'
    )
on conflict (id) do update
set
    company_id = excluded.company_id,
    lead_id = excluded.lead_id,
    assigned_user_id = excluded.assigned_user_id,
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    priority = excluded.priority,
    due_at = excluded.due_at,
    created_at = excluded.created_at;

insert into lead_followups (
    id,
    company_id,
    lead_id,
    assigned_user_id,
    followup_type,
    status,
    scheduled_at,
    notes,
    created_at
)
values
    (
        '55555555-5555-5555-5555-555555555551',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333332',
        '22222222-2222-2222-2222-222222222223',
        'call',
        'PENDING',
        now() + interval '3 hours',
        'Вернуться вечером и проговорить диапазон бюджета.',
        now() - interval '30 minutes'
    ),
    (
        '55555555-5555-5555-5555-555555555552',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'meeting',
        'PENDING',
        now() + interval '12 hours',
        'Накануне замера подтвердить время и список зон.',
        now() - interval '15 minutes'
    ),
    (
        '55555555-5555-5555-5555-555555555553',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333334',
        '22222222-2222-2222-2222-222222222223',
        'proposal',
        'PENDING',
        now() + interval '22 hours',
        'Вернуться после отправки сметы и закрепить решение по предоплате.',
        now() - interval '10 minutes'
    ),
    (
        '55555555-5555-5555-5555-555555555554',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333335',
        '22222222-2222-2222-2222-222222222222',
        'message',
        'PENDING',
        now() + interval '2 days',
        'Отправить клиенту подтверждение промежуточной готовности по производству.',
        now() - interval '5 minutes'
    )
on conflict (id) do update
set
    company_id = excluded.company_id,
    lead_id = excluded.lead_id,
    assigned_user_id = excluded.assigned_user_id,
    followup_type = excluded.followup_type,
    status = excluded.status,
    scheduled_at = excluded.scheduled_at,
    notes = excluded.notes,
    created_at = excluded.created_at;

insert into appointments (
    id,
    company_id,
    lead_id,
    assigned_user_id,
    appointment_type,
    status,
    scheduled_at,
    duration_minutes,
    location,
    notes,
    outcome_note,
    revenue_amount,
    created_at,
    confirmed_at,
    completed_at
)
values
    (
        '77777777-7777-7777-7777-777777777771',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222224',
        'visit',
        'CONFIRMED',
        now() + interval '1 day',
        90,
        'Рудный, мкр 15, дом 8',
        'Замер гардеробной, спальни и ниши под бытовой блок.',
        null,
        null,
        now() - interval '2 hours',
        now() - interval '1 hour',
        null
    ),
    (
        '77777777-7777-7777-7777-777777777772',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333334',
        '22222222-2222-2222-2222-222222222224',
        'visit',
        'COMPLETED',
        now() - interval '1 day',
        75,
        'Рудный, ул. Ленина, 77',
        'Сняли размеры ниши и проговорили внутреннее наполнение.',
        'Замер завершён, можно выпускать финальное КП.',
        1780000,
        now() - interval '2 days',
        now() - interval '1 day 2 hours',
        now() - interval '1 day'
    ),
    (
        '77777777-7777-7777-7777-777777777773',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333335',
        '22222222-2222-2222-2222-222222222224',
        'visit',
        'COMPLETED',
        now() - interval '5 days',
        120,
        'Рудный, ул. Топоркова, 19',
        'Замер кухни с островом и проверка инженерных выводов.',
        'Размеры сняты, проект согласован, клиент внёс предоплату.',
        5480000,
        now() - interval '6 days',
        now() - interval '5 days 2 hours',
        now() - interval '5 days'
    )
on conflict (id) do update
set
    company_id = excluded.company_id,
    lead_id = excluded.lead_id,
    assigned_user_id = excluded.assigned_user_id,
    appointment_type = excluded.appointment_type,
    status = excluded.status,
    scheduled_at = excluded.scheduled_at,
    duration_minutes = excluded.duration_minutes,
    location = excluded.location,
    notes = excluded.notes,
    outcome_note = excluded.outcome_note,
    revenue_amount = excluded.revenue_amount,
    created_at = excluded.created_at,
    confirmed_at = excluded.confirmed_at,
    completed_at = excluded.completed_at;

insert into lead_conversations (
    id,
    company_id,
    lead_id,
    channel,
    external_chat_id,
    started_at,
    last_message_at,
    created_at
)
values
    (
        '66666666-6666-6666-6666-666666666661',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333331',
        'telegram',
        'chat_asel_kitchen',
        now() - interval '30 minutes',
        now() - interval '6 minutes',
        now() - interval '30 minutes'
    ),
    (
        '66666666-6666-6666-6666-666666666662',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333332',
        'telegram',
        'chat_nurlan_hall',
        now() - interval '5 hours',
        now() - interval '45 minutes',
        now() - interval '5 hours'
    ),
    (
        '66666666-6666-6666-6666-666666666663',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        'telegram',
        'chat_imanovy_family',
        now() - interval '1 day',
        now() - interval '1 hour',
        now() - interval '1 day'
    ),
    (
        '66666666-6666-6666-6666-666666666664',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333334',
        'telegram',
        'chat_aigul_niche',
        now() - interval '2 days',
        now() - interval '2 hours',
        now() - interval '2 days'
    ),
    (
        '66666666-6666-6666-6666-666666666665',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333335',
        'telegram',
        'chat_dinara_island',
        now() - interval '6 days',
        now() - interval '40 minutes',
        now() - interval '6 days'
    )
on conflict (id) do update
set
    company_id = excluded.company_id,
    lead_id = excluded.lead_id,
    channel = excluded.channel,
    external_chat_id = excluded.external_chat_id,
    started_at = excluded.started_at,
    last_message_at = excluded.last_message_at,
    created_at = excluded.created_at;

insert into lead_messages (
    id,
    company_id,
    lead_id,
    conversation_id,
    direction,
    sender_type,
    external_message_id,
    message_text,
    raw_payload,
    created_at
)
values
    (
        '88888888-8888-8888-8888-888888888881',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333331',
        '66666666-6666-6666-6666-666666666661',
        'inbound',
        'lead',
        'msg_asel_1',
        'Здравствуйте, нужна кухня под потолок в новую квартиру.',
        '{"channel":"telegram"}'::jsonb,
        now() - interval '24 minutes'
    ),
    (
        '88888888-8888-8888-8888-888888888882',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333331',
        '66666666-6666-6666-6666-666666666661',
        'outbound',
        'manager',
        'msg_asel_2',
        'Принял заявку. Сейчас уточню размеры и удобное время для созвона.',
        '{"channel":"telegram"}'::jsonb,
        now() - interval '6 minutes'
    ),
    (
        '88888888-8888-8888-8888-888888888883',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333332',
        '66666666-6666-6666-6666-666666666662',
        'inbound',
        'lead',
        'msg_nurlan_1',
        'Добрый день, интересует шкаф в прихожую с зеркалом.',
        '{"channel":"telegram"}'::jsonb,
        now() - interval '4 hours 30 minutes'
    ),
    (
        '88888888-8888-8888-8888-888888888884',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333332',
        '66666666-6666-6666-6666-666666666662',
        'outbound',
        'manager',
        'msg_nurlan_2',
        'Вернусь к вам после 19:00, чтобы спокойно обсудить размеры и бюджет.',
        '{"channel":"telegram"}'::jsonb,
        now() - interval '45 minutes'
    ),
    (
        '88888888-8888-8888-8888-888888888885',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        '66666666-6666-6666-6666-666666666663',
        'outbound',
        'manager',
        'msg_imanovy_1',
        'Подтверждаем замер на завтра. Подготовьте, пожалуйста, все зоны хранения.',
        '{"channel":"telegram"}'::jsonb,
        now() - interval '1 hour'
    ),
    (
        '88888888-8888-8888-8888-888888888886',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333334',
        '66666666-6666-6666-6666-666666666664',
        'outbound',
        'manager',
        'msg_aigul_1',
        'Отправляю финальную смету и проект. Завтра вернусь по решению.',
        '{"channel":"telegram"}'::jsonb,
        now() - interval '2 hours'
    ),
    (
        '88888888-8888-8888-8888-888888888887',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333335',
        '66666666-6666-6666-6666-666666666665',
        'outbound',
        'manager',
        'msg_dinara_1',
        'Предоплата получена. Держу вас в курсе по сборке и монтажу.',
        '{"channel":"telegram"}'::jsonb,
        now() - interval '40 minutes'
    )
on conflict (id) do update
set
    company_id = excluded.company_id,
    lead_id = excluded.lead_id,
    conversation_id = excluded.conversation_id,
    direction = excluded.direction,
    sender_type = excluded.sender_type,
    external_message_id = excluded.external_message_id,
    message_text = excluded.message_text,
    raw_payload = excluded.raw_payload,
    created_at = excluded.created_at;

insert into lead_status_history (
    id,
    company_id,
    lead_id,
    previous_status,
    next_status,
    changed_by_user_id,
    change_reason,
    created_at
)
values
    (
        '99999999-9999-9999-9999-999999999981',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333332',
        'NEW',
        'CONTACTED',
        '22222222-2222-2222-2222-222222222223',
        'Первичный контакт состоялся, клиент попросил вернуться вечером.',
        now() - interval '4 hours'
    ),
    (
        '99999999-9999-9999-9999-999999999982',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        'CONTACTED',
        'MEETING',
        '22222222-2222-2222-2222-222222222222',
        'Клиент согласовал выезд замерщика.',
        now() - interval '20 hours'
    ),
    (
        '99999999-9999-9999-9999-999999999983',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333334',
        'MEETING',
        'PROPOSAL',
        '22222222-2222-2222-2222-222222222223',
        'Замер завершён, смета и проект готовы.',
        now() - interval '1 day'
    ),
    (
        '99999999-9999-9999-9999-999999999984',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333335',
        'PROPOSAL',
        'WON',
        '22222222-2222-2222-2222-222222222222',
        'Клиент внёс предоплату, заказ передан в производство.',
        now() - interval '3 days'
    )
on conflict (id) do update
set
    company_id = excluded.company_id,
    lead_id = excluded.lead_id,
    previous_status = excluded.previous_status,
    next_status = excluded.next_status,
    changed_by_user_id = excluded.changed_by_user_id,
    change_reason = excluded.change_reason,
    created_at = excluded.created_at;

insert into lead_events (
    id,
    company_id,
    lead_id,
    actor_user_id,
    event_type,
    payload,
    created_at
)
values
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333331',
        '22222222-2222-2222-2222-222222222222',
        'lead_order_context_updated',
        $json$
        {
          "updated_sections": ["project"],
          "context_patch": {
            "product": "Кухня",
            "requestType": "Прямая кухня с пеналом",
            "budget": "3,2–3,8 млн ₸",
            "address": "Рудный, ул. 50 лет Октября, 41",
            "clientComment": "Нужна кухня под потолок в новую квартиру. Важны светлые фасады и много хранения.",
            "summary": "Свежая заявка на кухню для новой квартиры. Нужен быстрый первый контакт и квалификация.",
            "nextAction": "Первичный звонок и квалификация по размерам кухни",
            "managerComment": "Свежий входящий лид. Важно успеть в SLA первого ответа."
          }
        }
        $json$::jsonb,
        now() - interval '8 minutes'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333332',
        '22222222-2222-2222-2222-222222222223',
        'lead_order_context_updated',
        $json$
        {
          "updated_sections": ["project"],
          "context_patch": {
            "product": "Шкаф",
            "requestType": "Шкаф в прихожую с зеркалом",
            "budget": "1,4–1,8 млн ₸",
            "address": "Рудный, ул. Парковая, 12",
            "clientComment": "Нужен встроенный шкаф с зеркалом во весь рост и секцией под обувь.",
            "summary": "Клиент уже ответил, но финальный бюджет и размеры нужно уточнить в вечернем звонке.",
            "nextAction": "Вернуться вечером и назначить замер",
            "managerComment": "Созвон после 19:00. Не давить, сначала снять рамку бюджета."
          }
        }
        $json$::jsonb,
        now() - interval '35 minutes'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'lead_order_context_updated',
        $json$
        {
          "updated_sections": ["project", "installation"],
          "context_patch": {
            "product": "Гардеробная",
            "requestType": "Гардеробная в спальню",
            "budget": "2,8–3,4 млн ₸",
            "address": "Рудный, мкр 15, дом 8",
            "clientComment": "Нужна гардеробная с островом, подсветкой и зоной хранения чемоданов.",
            "summary": "Замер подтверждён. После выезда нужно быстро собрать расчёт и согласовать проект.",
            "nextAction": "Провести замер и отправить расчёт",
            "managerComment": "Клиент просил заранее прислать, что нужно подготовить к замеру.",
            "measurement": {
              "status": "Замер назначен",
              "address": "Рудный, мкр 15, дом 8",
              "measurer": "Ерлан",
              "dimensions": "Размеры будут после выезда",
              "comment": "Подтверждён выезд замерщика на завтра",
              "result": "После выезда формируем расчёт и проект"
            }
          }
        }
        $json$::jsonb,
        now() - interval '55 minutes'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333334',
        '22222222-2222-2222-2222-222222222223',
        'lead_order_context_updated',
        $json$
        {
          "updated_sections": ["project", "calculation", "production", "order_items"],
          "context_patch": {
            "product": "Шкаф",
            "requestType": "Шкаф в нишу с зеркальными фасадами",
            "budget": "1,6–1,9 млн ₸",
            "address": "Рудный, ул. Ленина, 77",
            "clientComment": "Нужны светлые фасады, зеркало во весь рост и доводчики на всех ящиках.",
            "summary": "Замер завершён, смета и проект готовы. Дальше нужен дожим до предоплаты.",
            "nextAction": "Отправить финальное КП и вернуться по решению",
            "managerComment": "На следующий день после КП нужен обязательный follow-up по предоплате.",
            "prepaymentAmount": "500 000 ₸",
            "prepaymentStatus": "Запрошена",
            "finalAmount": "1 780 000 ₸",
            "estimateRange": "1 690 000 ₸",
            "productionStatus": "Не запущено",
            "project": {
              "status": "Проект готов",
              "description": "Шкаф в нишу до потолка с зеркальными фасадами и секцией под пылесос.",
              "materials": "ЛДСП Egger, кромка 2 мм",
              "hardware": "Blum",
              "color": "Кашемир + зеркало",
              "designerComment": "Согласовали внутреннее наполнение и зеркало во весь рост.",
              "preparedAt": "2026-06-05 15:30"
            },
            "order": {
              "preliminaryAmount": "1 690 000 ₸",
              "prepaymentAmount": "500 000 ₸",
              "finalAmount": "1 780 000 ₸",
              "balanceDue": "1 280 000 ₸",
              "calculation": {
                "preliminaryAmount": "1 690 000 ₸",
                "finalAmount": "1 780 000 ₸",
                "prepaymentAmount": "500 000 ₸",
                "balanceDue": "1 280 000 ₸",
                "prepaymentStatus": "Запрошена",
                "finalPaymentStatus": "Не запрошена"
              },
              "items": [
                {
                  "id": "niche-main",
                  "title": "Шкаф в нишу",
                  "zone": "Прихожая",
                  "quantity": 1,
                  "dimensions": "3200 x 2600 x 600 мм",
                  "material": "ЛДСП Egger",
                  "facade": "Зеркало + МДФ",
                  "hardware": "Blum",
                  "amount": "1 420 000 ₸",
                  "status": "Согласовано"
                },
                {
                  "id": "utility-block",
                  "title": "Хозсекция",
                  "zone": "Ниша справа",
                  "quantity": 1,
                  "dimensions": "800 x 2600 x 600 мм",
                  "material": "ЛДСП Egger",
                  "facade": "МДФ",
                  "hardware": "Blum",
                  "amount": "360 000 ₸",
                  "status": "Согласовано"
                }
              ],
              "production": {
                "handedToProduction": false,
                "stage": "Ожидает распил",
                "stageOwner": "Цех №1",
                "deadline": "2026-06-20",
                "comment": "Запуск после подтверждения предоплаты",
                "projectStatus": "Проект готов",
                "finalPaymentStatus": "Не запрошена"
              }
            }
          }
        }
        $json$::jsonb,
        now() - interval '2 hours'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333335',
        '22222222-2222-2222-2222-222222222222',
        'lead_order_context_updated',
        $json$
        {
          "updated_sections": ["project", "calculation", "production", "installation", "order_items"],
          "context_patch": {
            "product": "Кухня",
            "requestType": "Угловая кухня с островом",
            "budget": "5,2–5,8 млн ₸",
            "address": "Рудный, ул. Топоркова, 19",
            "clientComment": "Нужно завершить проект к новоселью. Важны остров, витрина и пенал под технику.",
            "summary": "Предоплата получена, кухня ушла в производство. Дальше контроль сборки и даты установки.",
            "nextAction": "Контроль сборки и подтверждение монтажа",
            "managerComment": "За неделю до монтажа нужно подтвердить готовность помещения.",
            "prepaymentAmount": "2 500 000 ₸",
            "prepaymentStatus": "Предоплата получена",
            "finalAmount": "5 480 000 ₸",
            "estimateRange": "5 250 000 ₸",
            "productionStatus": "В производство",
            "project": {
              "status": "Передано в цех",
              "description": "Угловая кухня с островом, витриной и пеналом под встроенную технику.",
              "materials": "ЛДСП Egger, столешница HPL",
              "hardware": "Blum + Hafele",
              "color": "Песочный матовый + тёплый дуб",
              "designerComment": "Фасады и ручки утверждены, остров укомплектован розеточным блоком.",
              "preparedAt": "2026-06-01 11:00"
            },
            "order": {
              "preliminaryAmount": "5 250 000 ₸",
              "prepaymentAmount": "2 500 000 ₸",
              "finalAmount": "5 480 000 ₸",
              "balanceDue": "2 980 000 ₸",
              "calculation": {
                "preliminaryAmount": "5 250 000 ₸",
                "finalAmount": "5 480 000 ₸",
                "prepaymentAmount": "2 500 000 ₸",
                "balanceDue": "2 980 000 ₸",
                "prepaymentStatus": "Предоплата получена",
                "finalPaymentStatus": "Ожидаем финальную оплату"
              },
              "items": [
                {
                  "id": "kitchen-main",
                  "title": "Основной гарнитур",
                  "zone": "Кухня",
                  "quantity": 1,
                  "dimensions": "4200 x 2750 x 600 мм",
                  "material": "ЛДСП Egger",
                  "facade": "МДФ матовый",
                  "hardware": "Blum",
                  "amount": "4 350 000 ₸",
                  "status": "В производстве"
                },
                {
                  "id": "island",
                  "title": "Остров",
                  "zone": "Кухня",
                  "quantity": 1,
                  "dimensions": "1800 x 900 x 900 мм",
                  "material": "ЛДСП Egger",
                  "facade": "МДФ матовый",
                  "hardware": "Hafele",
                  "amount": "1 130 000 ₸",
                  "status": "Сборка"
                }
              ],
              "production": {
                "handedToProduction": true,
                "handoverDate": "2026-06-03",
                "stage": "Сборка",
                "stageOwner": "Цех №2",
                "deadline": "2026-06-24",
                "comment": "Корпуса распилены, сборка идёт по графику.",
                "projectStatus": "Передано в цех",
                "finalPaymentStatus": "Ожидаем финальную оплату"
              },
              "installation": {
                "date": "2026-06-26",
                "address": "Рудный, ул. Топоркова, 19",
                "installer": "Монтажная бригада №1",
                "status": "Дата согласована",
                "comment": "За день до монтажа подтвердить готовность помещения."
              }
            },
            "installation": {
              "date": "2026-06-26",
              "address": "Рудный, ул. Топоркова, 19",
              "installer": "Монтажная бригада №1",
              "status": "Дата согласована",
              "comment": "За день до монтажа подтвердить готовность помещения."
            }
          }
        }
        $json$::jsonb,
        now() - interval '30 minutes'
    )
on conflict (id) do update
set
    company_id = excluded.company_id,
    lead_id = excluded.lead_id,
    actor_user_id = excluded.actor_user_id,
    event_type = excluded.event_type,
    payload = excluded.payload,
    created_at = excluded.created_at;

insert into lead_intake_sessions (
    id,
    company_id,
    lead_id,
    conversation_id,
    channel,
    status,
    current_step,
    answers,
    summary_text,
    created_at,
    updated_at,
    completed_at
)
values
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333331',
        '66666666-6666-6666-6666-666666666661',
        'telegram',
        'COMPLETED',
        'intake_complete',
        '{"business_type":"Квартира в новостройке","request":"Просчитать кухню под потолок","request_track":"consultation","pain_point":"Нужно много хранения и быстрый расчёт","current_flow":"Есть только размеры от застройщика","volume":"Одна кухня","desired_outcome":"Понять бюджет и записаться на замер"}'::jsonb,
        'Кухня в новую квартиру, клиент ждёт быстрый первый контакт.',
        now() - interval '28 minutes',
        now() - interval '8 minutes',
        now() - interval '8 minutes'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        '66666666-6666-6666-6666-666666666663',
        'telegram',
        'COMPLETED',
        'intake_complete',
        '{"business_type":"Семья с новым ремонтом","request":"Гардеробная в спальню","request_track":"booking","pain_point":"Нужно уместить одежду и чемоданы","current_flow":"Есть визуальный референс и пожелания","volume":"Одна гардеробная","desired_outcome":"Назначить замер и быстро получить расчёт"}'::jsonb,
        'Гардеробная с выездом на замер и быстрым переходом к расчёту.',
        now() - interval '1 day',
        now() - interval '1 hour',
        now() - interval '1 hour'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333334',
        '66666666-6666-6666-6666-666666666664',
        'telegram',
        'COMPLETED',
        'intake_complete',
        '{"business_type":"Квартира вторичка","request":"Шкаф в нишу","request_track":"estimate","pain_point":"Нужно вписаться в нишу и не потерять полезный объём","current_flow":"Замер уже проведён","volume":"Один встроенный шкаф","desired_outcome":"Получить смету и согласовать проект"}'::jsonb,
        'Шкаф в нишу после замера, активная стадия КП и согласования.',
        now() - interval '2 days',
        now() - interval '2 hours',
        now() - interval '2 hours'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333335',
        '66666666-6666-6666-6666-666666666665',
        'telegram',
        'COMPLETED',
        'intake_complete',
        '{"business_type":"Дом после ремонта","request":"Угловая кухня с островом","request_track":"estimate","pain_point":"Нужно уложиться к новоселью","current_flow":"Замер и проект уже согласованы","volume":"Одна кухня и остров","desired_outcome":"Запустить производство и выйти в монтаж"}'::jsonb,
        'Кухня с предоплатой и переходом в производство.',
        now() - interval '6 days',
        now() - interval '40 minutes',
        now() - interval '40 minutes'
    )
on conflict (id) do update
set
    company_id = excluded.company_id,
    lead_id = excluded.lead_id,
    conversation_id = excluded.conversation_id,
    channel = excluded.channel,
    status = excluded.status,
    current_step = excluded.current_step,
    answers = excluded.answers,
    summary_text = excluded.summary_text,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    completed_at = excluded.completed_at;
