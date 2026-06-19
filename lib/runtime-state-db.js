import { getPool, isLiveDatabaseEnabled, query } from "./db";

function normalizeTelegramUsername(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  return `@${trimmed.replace(/^@+/, "")}`;
}

function normalizeSubscriberRow(row) {
  if (!row) {
    return null;
  }

  return {
    chatId: String(row.chat_id),
    role: String(row.role),
    name: row.name || null,
    username: row.username || null,
    telegramUserId: row.telegram_user_id ? String(row.telegram_user_id) : null,
    source: row.source || "postgres",
    registeredAt: row.registered_at || null,
    lastSeenAt: row.last_seen_at || null
  };
}

export function isRuntimeStatePostgresEnabled(companyId) {
  return Boolean(companyId) && isLiveDatabaseEnabled();
}

export async function listTelegramSubscribersFromDb(companyId) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return [];
  }

  const result = await query(
    `
      select
        chat_id,
        role,
        full_name as name,
        telegram_username as username,
        telegram_user_id,
        source,
        registered_at,
        last_seen_at
      from telegram_subscribers
      where company_id = $1
      order by registered_at asc
    `,
    [companyId]
  );

  return result.rows.map(normalizeSubscriberRow).filter(Boolean);
}

export async function upsertTelegramSubscriberInDb(companyId, subscriber) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return null;
  }

  const result = await query(
    `
      insert into telegram_subscribers (
        company_id,
        chat_id,
        role,
        full_name,
        telegram_username,
        telegram_user_id,
        source,
        registered_at,
        last_seen_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, coalesce($8::timestamptz, now()), now())
      on conflict (company_id, chat_id, role)
      do update set
        full_name = excluded.full_name,
        telegram_username = excluded.telegram_username,
        telegram_user_id = excluded.telegram_user_id,
        source = excluded.source,
        last_seen_at = now()
      returning
        chat_id,
        role,
        full_name as name,
        telegram_username as username,
        telegram_user_id,
        source,
        registered_at,
        last_seen_at
    `,
    [
      companyId,
      String(subscriber.chatId),
      String(subscriber.role),
      subscriber.name || null,
      normalizeTelegramUsername(subscriber.username),
      subscriber.telegramUserId ? String(subscriber.telegramUserId) : null,
      subscriber.source || "postgres",
      subscriber.registeredAt || null
    ]
  );

  return normalizeSubscriberRow(result.rows[0]);
}

export async function deleteTelegramSubscribersByChatIdInDb(companyId, chatId) {
  if (!isRuntimeStatePostgresEnabled(companyId) || !chatId) {
    return;
  }

  await query(
    `
      delete from telegram_subscribers
      where company_id = $1
        and chat_id = $2
    `,
    [companyId, String(chatId)]
  );
}

export async function findTelegramLeadReferenceInDb(companyId, payload = {}) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return null;
  }

  const chatId = payload.chatId ? String(payload.chatId) : null;
  const telegramUserId = payload.telegramUserId ? String(payload.telegramUserId) : null;
  const username = normalizeTelegramUsername(payload.username);
  const phone = String(payload.reference || payload.phone || "").trim() || null;

  const ledgerResult = await query(
    `
      select
        tcl.lead_id,
        tcl.external_chat_id,
        tcl.telegram_user_id,
        tcl.telegram_username,
        tcl.phone,
        tcl.created_at
      from telegram_client_leads tcl
      where tcl.company_id = $1
        and (
          ($2::text is not null and tcl.external_chat_id = $2)
          or ($3::text is not null and tcl.telegram_user_id = $3)
          or ($4::text is not null and lower(coalesce(tcl.telegram_username, '')) = lower($4))
          or ($5::text is not null and tcl.phone = $5)
        )
      order by tcl.created_at desc
      limit 1
    `,
    [companyId, chatId, telegramUserId, username, phone]
  );

  if (ledgerResult.rows[0]?.lead_id) {
    return {
      leadId: ledgerResult.rows[0].lead_id,
      source: "telegram_client_leads"
    };
  }

  if (chatId) {
    const conversationResult = await query(
      `
        select lead_id
        from lead_conversations
        where company_id = $1
          and channel = 'telegram'
          and external_chat_id = $2
        order by created_at desc
        limit 1
      `,
      [companyId, chatId]
    );

    if (conversationResult.rows[0]?.lead_id) {
      return {
        leadId: conversationResult.rows[0].lead_id,
        source: "lead_conversations"
      };
    }
  }

  if (username || phone) {
    const leadResult = await query(
      `
        select id
        from leads
        where company_id = $1
          and (
            ($2::text is not null and lower(coalesce(telegram_username, '')) = lower($2))
            or ($3::text is not null and phone = $3)
          )
        order by created_at desc
        limit 1
      `,
      [companyId, username, phone]
    );

    if (leadResult.rows[0]?.id) {
      return {
        leadId: leadResult.rows[0].id,
        source: "leads"
      };
    }
  }

  return null;
}

export async function resolveLeadRecordInDb(companyId, reference) {
  if (!isRuntimeStatePostgresEnabled(companyId) || !reference) {
    return null;
  }

  const normalizedReference = String(reference).trim();

  if (!normalizedReference) {
    return null;
  }

  const username = normalizeTelegramUsername(normalizedReference);
  const result = await query(
    `
      select id, status
      from leads
      where company_id = $1
        and (
          id::text = $2
          or coalesce(full_name, '') = $2
          or coalesce(phone, '') = $2
          or lower(coalesce(telegram_username, '')) = lower($3)
        )
      order by created_at desc
      limit 1
    `,
    [companyId, normalizedReference, username]
  );

  return result.rows[0] || null;
}

export async function createTelegramLeadInDb(companyId, payload = {}) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return null;
  }

  const pool = getPool();

  if (!pool) {
    return null;
  }

  const chatId = payload.chatId ? String(payload.chatId) : null;
  const telegramUserId = payload.telegramUserId ? String(payload.telegramUserId) : null;
  const telegramUsername = normalizeTelegramUsername(payload.username);
  const fullName = String(payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const product = String(payload.product || "").trim();
  const note = String(payload.note || "").trim();
  const sourceLabel = String(payload.sourceLabel || "Telegram bot").trim() || "Telegram bot";
  const clientMessage = [product ? `Product: ${product}` : null, note || null]
    .filter(Boolean)
    .join("\n");
  const leadNotes = [
    product ? `Product: ${product}` : null,
    note ? `Client note: ${note}` : null,
    chatId ? `Telegram chat: ${chatId}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const client = await pool.connect();
  const run = (text, params = []) => client.query(text, params);
  let transactionStarted = false;

  try {
    const existingReference = await findTelegramLeadReferenceInDb(companyId, {
      chatId,
      telegramUserId,
      username: telegramUsername,
      phone
    });

    if (existingReference?.leadId) {
      return {
        leadId: existingReference.leadId,
        created: false
      };
    }

    await run("begin");
    transactionStarted = true;

    const leadResult = await run(
      `
        insert into leads (
          company_id,
          full_name,
          phone,
          telegram_username,
          source,
          channel,
          status,
          temperature,
          notes,
          first_response_due_at
        )
        values ($1, $2, $3, $4, $5, 'telegram', 'NEW', 'warm', $6, now() + interval '2 hours')
        returning id, created_at
      `,
      [
        companyId,
        fullName || null,
        phone || null,
        telegramUsername,
        sourceLabel,
        leadNotes || null
      ]
    );

    const leadId = leadResult.rows[0].id;
    let conversationId = null;

    if (chatId) {
      const conversationResult = await run(
        `
          insert into lead_conversations (
            company_id,
            lead_id,
            channel,
            external_chat_id,
            started_at,
            last_message_at
          )
          values ($1, $2, 'telegram', $3, now(), now())
          returning id
        `,
        [companyId, leadId, chatId]
      );

      conversationId = conversationResult.rows[0]?.id || null;
    }

    if (conversationId) {
      await run(
        `
          insert into lead_messages (
            company_id,
            lead_id,
            conversation_id,
            direction,
            sender_type,
            message_text,
            raw_payload
          )
          values ($1, $2, $3, 'inbound', 'lead', $4, $5::jsonb)
        `,
        [
          companyId,
          leadId,
          conversationId,
          clientMessage || `Client request from Telegram: ${product}`,
          JSON.stringify(payload)
        ]
      );

      await run(
        `
          insert into lead_intake_sessions (
            company_id,
            lead_id,
            conversation_id,
            channel,
            status,
            current_step,
            answers,
            summary_text,
            completed_at
          )
          values (
            $1,
            $2,
            $3,
            'telegram',
            'COMPLETED',
            'done',
            $4::jsonb,
            $5,
            now()
          )
        `,
        [
          companyId,
          leadId,
          conversationId,
          JSON.stringify({
            request_track: "telegram_client",
            full_name: fullName,
            phone,
            product,
            note
          }),
          note || `Telegram request for ${product}`
        ]
      );
    }

    const taskResult = await run(
      `
        insert into tasks (
          company_id,
          lead_id,
          title,
          description,
          status,
          priority,
          due_at
        )
        values ($1, $2, $3, $4, 'OPEN', 'high', now() + interval '2 hours')
        returning id
      `,
      [
        companyId,
        leadId,
        "Связаться с клиентом и уточнить детали заказа",
        `Клиент пришёл из Telegram. Изделие: ${product}. Нужно уточнить состав заказа, бюджет и удобное время для замера.`
      ]
    );

    await run(
      `
        insert into lead_status_history (
          company_id,
          lead_id,
          previous_status,
          next_status,
          change_reason
        )
        values ($1, $2, null, 'NEW', $3)
      `,
      [companyId, leadId, "Заявка создана клиентом через Telegram-бот"]
    );

    await run(
      `
        insert into lead_events (
          company_id,
          lead_id,
          event_type,
          payload
        )
        values
          ($1, $2, 'lead_created', $3::jsonb),
          ($1, $2, 'lead_intake_completed', $4::jsonb),
          ($1, $2, 'task_created', $5::jsonb)
      `,
      [
        companyId,
        leadId,
        JSON.stringify({
          source: sourceLabel,
          channel: "telegram",
          phone,
          telegram_username: telegramUsername
        }),
        JSON.stringify({
          request_track: "telegram_client",
          summary_text: note || `Telegram request for ${product}`
        }),
        JSON.stringify({
          id: taskResult.rows[0]?.id || null,
          title: "Связаться с клиентом и уточнить детали заказа",
          description: `Клиент пришёл из Telegram. Изделие: ${product}. Нужно уточнить состав заказа, бюджет и удобное время для замера.`
        })
      ]
    );

    await run(
      `
        insert into telegram_client_leads (
          company_id,
          lead_id,
          external_chat_id,
          telegram_user_id,
          telegram_username,
          client_name,
          phone,
          product,
          note,
          source_label,
          raw_payload
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      `,
      [
        companyId,
        leadId,
        chatId,
        telegramUserId,
        telegramUsername,
        fullName,
        phone,
        product,
        note || null,
        sourceLabel,
        JSON.stringify(payload)
      ]
    );

    await run("commit");

    return {
      leadId,
      created: true
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("rollback");
    }
    throw error;
  } finally {
    client.release();
  }
}
