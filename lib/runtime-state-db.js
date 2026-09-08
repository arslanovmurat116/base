import { buildBusinessEvent, appendBusinessEvent } from "./core/business-events";
import { getPool, isLiveDatabaseEnabled, query } from "./db";
import { buildStaffProjectPatch } from "./project-workflow";

function normalizeTelegramUsername(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  return `@${trimmed.replace(/^@+/, "")}`;
}

function normalizeClientStatusFromLeadStatus(status) {
  switch (String(status || "").toUpperCase()) {
    case "WON":
      return "ACTIVE";
    case "LOST":
      return "INACTIVE";
    default:
      return "PROSPECT";
  }
}

function normalizeDealStageKeyFromLeadStatus(status) {
  switch (String(status || "").toUpperCase()) {
    case "CONTACTED":
      return "contacted";
    case "QUALIFIED":
      return "qualified";
    case "MEETING":
      return "appointment";
    case "PROPOSAL":
      return "proposal";
    case "WON":
      return "won";
    case "LOST":
      return "lost";
    default:
      return "new";
  }
}

function normalizeDealStatusFromLeadStatus(status) {
  switch (String(status || "").toUpperCase()) {
    case "WON":
      return "CLOSED_WON";
    case "LOST":
      return "CLOSED_LOST";
    default:
      return "OPEN";
  }
}

function buildDealTitleFromLeadRecord(leadRecord) {
  const name = String(
    leadRecord?.full_name ||
      leadRecord?.telegram_username ||
      leadRecord?.client_name ||
      "Lead"
  ).trim();
  const topic = String(
    leadRecord?.product || leadRecord?.source_label || leadRecord?.source || "New business case"
  ).trim();

  return `${name} · ${topic}`;
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

function cloneRuntimePayload(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeRuntimeTimestamp(value, fallbackValue = null) {
  const raw = value || fallbackValue;

  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

export async function findTelegramLeadReferenceInDb(companyId, payload = {}, executor = query) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return null;
  }

  const chatId = payload.chatId ? String(payload.chatId) : null;
  const telegramUserId = payload.telegramUserId ? String(payload.telegramUserId) : null;
  const username = normalizeTelegramUsername(payload.username);
  const phone = String(payload.reference || payload.phone || "").trim() || null;

  const ledgerResult = await executor(
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
    const conversationResult = await executor(
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
    const leadResult = await executor(
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

function buildLeadIdentityLockKey(companyId, identity) {
  if (!companyId || !identity) {
    return null;
  }

  return `bose-core-sync:${companyId}:${identity}`;
}

async function lockTelegramLeadIdentityInDb(companyId, payload = {}, executor = query) {
  const identity =
    payload.telegramUserId ||
    payload.phone ||
    payload.telegramUsername ||
    payload.username ||
    payload.chatId ||
    null;
  const lockKey = buildLeadIdentityLockKey(companyId, identity);

  if (!lockKey) {
    return;
  }

  await executor("select pg_advisory_xact_lock(hashtext($1))", [lockKey]);
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

async function loadLeadCoreSyncRecordInDb(companyId, leadId, executor = query) {
  const result = await executor(
    `
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
        l.notes,
        l.created_at,
        l.updated_at,
        tcl.telegram_user_id,
        coalesce(tcl.telegram_username, l.telegram_username) as resolved_telegram_username,
        tcl.product,
        tcl.source_label,
        tcl.external_chat_id,
        tcl.client_name
      from leads l
      left join lateral (
        select
          telegram_user_id,
          telegram_username,
          product,
          source_label,
          external_chat_id,
          client_name
        from telegram_client_leads
        where company_id = l.company_id
          and lead_id = l.id
        order by created_at desc
        limit 1
      ) tcl on true
      where l.company_id = $1
        and l.id = $2
      limit 1
    `,
    [companyId, leadId]
  );

  return result.rows[0] || null;
}

async function lockLeadCoreIdentityInDb(companyId, leadRecord, executor = query) {
  const identity =
    leadRecord?.telegram_user_id ||
    leadRecord?.phone ||
    leadRecord?.resolved_telegram_username ||
    leadRecord?.telegram_username ||
    leadRecord?.id;

  if (!identity) {
    return;
  }

  const lockKey = buildLeadIdentityLockKey(companyId, identity);

  if (!lockKey) {
    return;
  }

  await executor("select pg_advisory_xact_lock(hashtext($1))", [lockKey]);
}

export async function syncLeadCoreRecordsInDb(
  companyId,
  leadReference,
  executor = query,
  options = {}
) {
  if (!isRuntimeStatePostgresEnabled(companyId) || !leadReference) {
    return null;
  }

  const leadId =
    typeof leadReference === "string"
      ? leadReference
      : leadReference.leadId || leadReference.id || null;

  if (!leadId) {
    return null;
  }

  try {
    const leadRecord = await loadLeadCoreSyncRecordInDb(companyId, leadId, executor);

    if (!leadRecord?.id) {
      return null;
    }

    await lockLeadCoreIdentityInDb(companyId, leadRecord, executor);

    const telegramUsername =
      normalizeTelegramUsername(
        leadRecord.resolved_telegram_username || leadRecord.telegram_username
      ) || null;
    const telegramUserId = leadRecord.telegram_user_id
      ? String(leadRecord.telegram_user_id)
      : null;
    const phone = String(leadRecord.phone || "").trim() || null;
    const displayName =
      String(
        leadRecord.full_name ||
          leadRecord.client_name ||
          telegramUsername ||
          "Client"
      ).trim() || "Client";

    const existingClientResult = await executor(
      `
        select
          id,
          source_lead_id,
          display_name,
          primary_phone,
          telegram_user_id,
          telegram_username,
          owner_user_id
        from clients
        where company_id = $1
          and (
            source_lead_id = $2
            or ($3::text is not null and telegram_user_id = $3)
            or ($4::text is not null and primary_phone = $4)
            or ($5::text is not null and lower(coalesce(telegram_username, '')) = lower($5))
          )
        order by
          case when source_lead_id = $2 then 0 else 1 end,
          created_at asc
        limit 1
      `,
      [companyId, leadId, telegramUserId, phone, telegramUsername]
    );

    let clientId = existingClientResult.rows[0]?.id || null;
    let clientCreated = false;
    let clientLinked = false;

    if (!clientId) {
      const insertedClientResult = await executor(
        `
          insert into clients (
            company_id,
            source_lead_id,
            owner_user_id,
            display_name,
            primary_phone,
            telegram_user_id,
            telegram_username,
            status,
            notes,
            created_at,
            updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
          on conflict (company_id, source_lead_id)
          do update set
            owner_user_id = coalesce(excluded.owner_user_id, clients.owner_user_id),
            display_name = excluded.display_name,
            primary_phone = coalesce(excluded.primary_phone, clients.primary_phone),
            telegram_user_id = coalesce(excluded.telegram_user_id, clients.telegram_user_id),
            telegram_username = coalesce(excluded.telegram_username, clients.telegram_username),
            status = excluded.status,
            notes = coalesce(excluded.notes, clients.notes),
            updated_at = now()
          returning id
        `,
        [
          companyId,
          leadId,
          leadRecord.assigned_user_id || null,
          displayName,
          phone,
          telegramUserId,
          telegramUsername,
          normalizeClientStatusFromLeadStatus(leadRecord.status),
          leadRecord.notes || null
        ]
      );

      clientId = insertedClientResult.rows[0]?.id || null;
      clientCreated = Boolean(clientId);
    } else {
      const existingClient = existingClientResult.rows[0];
      const sourceLeadId = existingClient.source_lead_id || null;
      clientLinked = sourceLeadId !== leadId && !sourceLeadId;

      await executor(
        `
          update clients
          set
            source_lead_id = coalesce(source_lead_id, $2),
            owner_user_id = coalesce($3, owner_user_id),
            display_name = coalesce(nullif(display_name, ''), $4),
            primary_phone = coalesce(primary_phone, $5),
            telegram_user_id = coalesce(telegram_user_id, $6),
            telegram_username = coalesce(telegram_username, $7),
            status = $8,
            notes = coalesce(notes, $9),
            updated_at = now()
          where company_id = $1
            and id = $10
        `,
        [
          companyId,
          leadId,
          leadRecord.assigned_user_id || null,
          displayName,
          phone,
          telegramUserId,
          telegramUsername,
          normalizeClientStatusFromLeadStatus(leadRecord.status),
          leadRecord.notes || null,
          clientId
        ]
      );
    }

    const existingDealResult = await executor(
      `
        select id
        from deals
        where company_id = $1
          and lead_id = $2
        limit 1
      `,
      [companyId, leadId]
    );

    let dealId = existingDealResult.rows[0]?.id || null;
    let dealCreated = false;

    if (!dealId) {
      const insertedDealResult = await executor(
        `
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
          values ($1, $2, $3, $4, $5, 'sales', $6, $7, $8::jsonb, now(), now())
          on conflict (company_id, lead_id)
          do update set
            client_id = coalesce(excluded.client_id, deals.client_id),
            owner_user_id = coalesce(excluded.owner_user_id, deals.owner_user_id),
            title = excluded.title,
            stage_key = excluded.stage_key,
            status = excluded.status,
            payload = deals.payload || excluded.payload,
            updated_at = now()
          returning id
        `,
        [
          companyId,
          leadId,
          clientId,
          leadRecord.assigned_user_id || null,
          buildDealTitleFromLeadRecord(leadRecord),
          normalizeDealStageKeyFromLeadStatus(leadRecord.status),
          normalizeDealStatusFromLeadStatus(leadRecord.status),
          JSON.stringify({
            source: leadRecord.source || null,
            channel: leadRecord.channel || null,
            product: leadRecord.product || null,
            dual_write: true
          })
        ]
      );

      dealId = insertedDealResult.rows[0]?.id || null;
      dealCreated = Boolean(dealId);
    } else {
      await executor(
        `
          update deals
          set
            client_id = coalesce($3, client_id),
            owner_user_id = coalesce($4, owner_user_id),
            title = $5,
            stage_key = $6,
            status = $7,
            payload = payload || $8::jsonb,
            updated_at = now()
          where company_id = $1
            and lead_id = $2
        `,
        [
          companyId,
          leadId,
          clientId,
          leadRecord.assigned_user_id || null,
          buildDealTitleFromLeadRecord(leadRecord),
          normalizeDealStageKeyFromLeadStatus(leadRecord.status),
          normalizeDealStatusFromLeadStatus(leadRecord.status),
          JSON.stringify({
            latestLeadStatus: leadRecord.status,
            dual_write: true
          })
        ]
      );
    }

    if (options.emitEvents !== false) {
      if (clientCreated) {
        await appendBusinessEvent(
          buildBusinessEvent({
            companyId,
            aggregateType: "client",
            aggregateId: clientId,
            eventName: "ClientCreated",
            payload: {
              leadId,
              phone,
              telegramUserId,
              telegramUsername
            }
          }),
          executor
        );
      } else if (clientLinked) {
        await appendBusinessEvent(
          buildBusinessEvent({
            companyId,
            aggregateType: "client",
            aggregateId: clientId,
            eventName: "ClientLinked",
            payload: {
              leadId
            }
          }),
          executor
        );
      }

      if (dealCreated) {
        await appendBusinessEvent(
          buildBusinessEvent({
            companyId,
            aggregateType: "deal",
            aggregateId: dealId,
            eventName: "DealCreated",
            payload: {
              leadId,
              clientId,
              stageKey: normalizeDealStageKeyFromLeadStatus(leadRecord.status)
            }
          }),
          executor
        );
      }
    }

    return {
      leadId,
      clientId,
      dealId,
      clientCreated,
      clientLinked,
      dealCreated
    };
  } catch (error) {
    if (
      ["42P01", "42703", "42P10"].includes(String(error?.code || "")) ||
      /(clients|deals|business_events)/i.test(String(error?.message || ""))
    ) {
      return {
        leadId,
        skipped: true,
        reason: error.message
      };
    }

    throw error;
  }
}

export async function createTelegramLeadInDb(companyId, payload = {}) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return null;
  }

  const pool = getPool();

  if (!pool) {
    return null;
  }

  // The staff author must not become the customer identity of every order they enter.
  const staffRequest = Boolean(payload.staffRequest && payload.sourceRef);
  const chatId = !staffRequest && payload.chatId ? String(payload.chatId) : null;
  const telegramUserId = !staffRequest && payload.telegramUserId ? String(payload.telegramUserId) : null;
  const telegramUsername = staffRequest ? null : normalizeTelegramUsername(payload.username);
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
    await run("begin");
    transactionStarted = true;

    if (staffRequest) {
      await run("select pg_advisory_xact_lock(hashtext($1))", [`${companyId}:staff-project:${payload.sourceRef}`]);
      const duplicate = await run("select lead_id from telegram_client_leads where company_id = $1 and source_ref = $2", [companyId, payload.sourceRef]);
      if (duplicate.rows[0]) {
        await run("commit");
        transactionStarted = false;
        return { leadId: duplicate.rows[0].lead_id, created: false };
      }
    }

    await lockTelegramLeadIdentityInDb(
      companyId,
      {
        chatId,
        telegramUserId,
        telegramUsername,
        username: telegramUsername,
        phone
      },
      run
    );

    const existingReference = staffRequest ? null : await findTelegramLeadReferenceInDb(
      companyId,
      {
        chatId,
        telegramUserId,
        username: telegramUsername,
        phone
      },
      run
    );

    if (existingReference?.leadId) {
      await syncLeadCoreRecordsInDb(companyId, existingReference.leadId, run);
      await run("commit");
      transactionStarted = false;

      return {
        leadId: existingReference.leadId,
        created: false
      };
    }

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
    if (staffRequest) {
      await run(`update leads set assigned_user_id = (
        select id from users where company_id = $1 and full_name = $3 and is_active
        order by created_at limit 1) where company_id = $1 and id = $2`, [companyId, leadId, payload.manager]);
      const { project, ...basePatch } = buildStaffProjectPatch(payload);
      await run("insert into lead_runtime_patches(company_id,lead_id,patch) values ($1,$2,$3::jsonb)", [companyId, leadId, JSON.stringify(basePatch)]);
      await run("insert into lead_events(company_id,lead_id,event_type,payload) values ($1,$2,'lead_order_context_updated',$3::jsonb)", [companyId, leadId, JSON.stringify({ updated_sections: ["project"], context_patch: { project } })]);
    }
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

    await appendBusinessEvent(
      buildBusinessEvent({
        companyId,
        aggregateType: "lead",
        aggregateId: leadId,
        eventName: "LeadCreated",
        channel: "telegram",
        payload: {
          source: sourceLabel,
          channel: "telegram",
          phone,
          telegramUserId,
          telegramUsername
        }
      }),
      run
    );

    if (staffRequest) {
      await run("update telegram_client_leads set source_ref = $3 where company_id = $1 and lead_id = $2", [companyId, leadId, payload.sourceRef]);
      await run("update tasks set assigned_user_id = (select assigned_user_id from leads where id = $2 and company_id = $1) where company_id = $1 and lead_id = $2", [companyId, leadId]);
    }

    const coreSync = await syncLeadCoreRecordsInDb(companyId, leadId, run, {
      emitEvents: true
    });

    await run("commit");
    transactionStarted = false;

    return {
      leadId,
      clientId: coreSync?.clientId || null,
      dealId: coreSync?.dealId || null,
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

function normalizePilotRequestRow(row) {
  if (!row) {
    return null;
  }

  const payload = cloneRuntimePayload(row.payload) || {};

  return {
    ...payload,
    id: row.runtime_id || payload.id || null,
    requestNumber: row.request_number || payload.requestNumber || null,
    status: row.status || payload.status || "NEW",
    workshopName: row.workshop_name || payload.workshopName || "",
    telegramChatId: row.telegram_chat_id || payload.telegramChatId || null,
    createdAt: normalizeRuntimeTimestamp(payload.createdAt, row.created_at),
    updatedAt: normalizeRuntimeTimestamp(payload.updatedAt, row.updated_at)
  };
}

function normalizeProductLaunchRow(row) {
  if (!row) {
    return null;
  }

  const payload = cloneRuntimePayload(row.payload) || {};

  return {
    ...payload,
    id: row.runtime_id || payload.id || null,
    launchNumber: row.launch_number || payload.launchNumber || null,
    pilotRequestId: row.pilot_request_id || payload.pilotRequestId || null,
    status: row.status || payload.status || "KICKOFF_PENDING",
    workshopName: row.workshop_name || payload.workshopName || "",
    createdAt: normalizeRuntimeTimestamp(payload.createdAt, row.created_at),
    updatedAt: normalizeRuntimeTimestamp(payload.updatedAt, row.updated_at)
  };
}

function normalizeCustomerSuccessRow(row) {
  if (!row) {
    return null;
  }

  const payload = cloneRuntimePayload(row.payload) || {};

  return {
    ...payload,
    id: row.runtime_id || payload.id || null,
    successNumber: row.success_number || payload.successNumber || null,
    launchId: row.launch_id || payload.launchId || null,
    status: row.status || payload.status || "FIRST_WEEK",
    workshopName: row.workshop_name || payload.workshopName || "",
    createdAt: normalizeRuntimeTimestamp(payload.createdAt, row.created_at),
    updatedAt: normalizeRuntimeTimestamp(payload.updatedAt, row.updated_at)
  };
}

function normalizeLeadRuntimePatchRow(row) {
  if (!row) {
    return null;
  }

  return {
    leadId: row.lead_id ? String(row.lead_id) : null,
    patch: cloneRuntimePayload(row.patch) || {},
    createdAt: normalizeRuntimeTimestamp(row.created_at),
    updatedAt: normalizeRuntimeTimestamp(row.updated_at)
  };
}

function normalizeTelegramRegistrationStateRow(row) {
  if (!row) {
    return null;
  }

  return {
    chatId: row.chat_id ? String(row.chat_id) : null,
    payload: cloneRuntimePayload(row.payload) || {},
    createdAt: normalizeRuntimeTimestamp(row.created_at),
    updatedAt: normalizeRuntimeTimestamp(row.updated_at)
  };
}

function normalizeTelegramDispatchLogRow(row) {
  if (!row) {
    return null;
  }

  return {
    key: row.dispatch_key ? String(row.dispatch_key) : null,
    sentAt: normalizeRuntimeTimestamp(row.sent_at),
    updatedAt: normalizeRuntimeTimestamp(row.updated_at)
  };
}

async function upsertJsonPayloadRecord({
  companyId,
  tableName,
  runtimeId,
  uniqueNumberColumn,
  uniqueNumberValue,
  status,
  workshopName,
  extraColumns = {},
  payload = {},
  createdAt = null,
  updatedAt = null
}) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return null;
  }

  const extraEntries = Object.entries(extraColumns);
  const insertColumns = [
    "company_id",
    "runtime_id",
    uniqueNumberColumn,
    "status",
    "workshop_name",
    ...extraEntries.map(([column]) => column),
    "payload",
    "created_at",
    "updated_at"
  ];

  const values = [
    companyId,
    runtimeId,
    uniqueNumberValue,
    status,
    workshopName || null,
    ...extraEntries.map(([, value]) => value ?? null),
    JSON.stringify(payload),
    normalizeRuntimeTimestamp(createdAt),
    normalizeRuntimeTimestamp(updatedAt)
  ];

  const paramsSql = values.map((_, index) => `$${index + 1}`).join(", ");
  const extraColumnAssignments = extraEntries
    .map(([column]) => `${column} = excluded.${column}`)
    .join(",\n        ");

  const updateAssignments = [
    `${uniqueNumberColumn} = excluded.${uniqueNumberColumn}`,
    "status = excluded.status",
    "workshop_name = excluded.workshop_name",
    extraColumnAssignments,
    "payload = excluded.payload",
    "updated_at = coalesce(excluded.updated_at, now())"
  ]
    .filter(Boolean)
    .join(",\n        ");

  const result = await query(
    `
      insert into ${tableName} (
        ${insertColumns.join(",\n        ")}
      )
      values (${paramsSql})
      on conflict (company_id, runtime_id)
      do update set
        ${updateAssignments}
      returning *
    `,
    values
  );

  return result.rows[0] || null;
}

export async function listPilotRequestsFromDb(companyId) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return [];
  }

  const result = await query(
    `
      select *
      from product_pilot_requests
      where company_id = $1
      order by updated_at desc, created_at desc
    `,
    [companyId]
  );

  return result.rows.map(normalizePilotRequestRow).filter(Boolean);
}

export async function upsertPilotRequestInDb(companyId, request) {
  const row = await upsertJsonPayloadRecord({
    companyId,
    tableName: "product_pilot_requests",
    runtimeId: String(request.id),
    uniqueNumberColumn: "request_number",
    uniqueNumberValue: request.requestNumber || request.id,
    status: request.status || "NEW",
    workshopName: request.workshopName || "",
    extraColumns: {
      telegram_chat_id: request.telegramChatId || null
    },
    payload: request,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  });

  return normalizePilotRequestRow(row);
}

export async function listProductLaunchesFromDb(companyId) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return [];
  }

  const result = await query(
    `
      select *
      from product_launch_handoffs
      where company_id = $1
      order by updated_at desc, created_at desc
    `,
    [companyId]
  );

  return result.rows.map(normalizeProductLaunchRow).filter(Boolean);
}

export async function upsertProductLaunchInDb(companyId, launch) {
  const row = await upsertJsonPayloadRecord({
    companyId,
    tableName: "product_launch_handoffs",
    runtimeId: String(launch.id),
    uniqueNumberColumn: "launch_number",
    uniqueNumberValue: launch.launchNumber || launch.id,
    status: launch.status || "KICKOFF_PENDING",
    workshopName: launch.workshopName || "",
    extraColumns: {
      pilot_request_id: launch.pilotRequestId || null
    },
    payload: launch,
    createdAt: launch.createdAt,
    updatedAt: launch.updatedAt
  });

  return normalizeProductLaunchRow(row);
}

export async function listCustomerSuccessLoopsFromDb(companyId) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return [];
  }

  const result = await query(
    `
      select *
      from customer_success_loops
      where company_id = $1
      order by updated_at desc, created_at desc
    `,
    [companyId]
  );

  return result.rows.map(normalizeCustomerSuccessRow).filter(Boolean);
}

export async function upsertCustomerSuccessLoopInDb(companyId, success) {
  const row = await upsertJsonPayloadRecord({
    companyId,
    tableName: "customer_success_loops",
    runtimeId: String(success.id),
    uniqueNumberColumn: "success_number",
    uniqueNumberValue: success.successNumber || success.id,
    status: success.status || "FIRST_WEEK",
    workshopName: success.workshopName || "",
    extraColumns: {
      launch_id: success.launchId || null
    },
    payload: success,
    createdAt: success.createdAt,
    updatedAt: success.updatedAt
  });

  return normalizeCustomerSuccessRow(row);
}

export async function listLeadRuntimePatchesFromDb(companyId) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return [];
  }

  const result = await query(
    `
      select *
      from lead_runtime_patches
      where company_id = $1
      order by updated_at desc, created_at desc
    `,
    [companyId]
  );

  return result.rows.map(normalizeLeadRuntimePatchRow).filter(Boolean);
}

export async function getLeadRuntimePatchFromDb(companyId, leadId) {
  if (!isRuntimeStatePostgresEnabled(companyId) || !leadId) {
    return null;
  }

  const result = await query(
    `
      select *
      from lead_runtime_patches
      where company_id = $1
        and lead_id = $2
      limit 1
    `,
    [companyId, String(leadId)]
  );

  return normalizeLeadRuntimePatchRow(result.rows[0]);
}

export async function upsertLeadRuntimePatchInDb(companyId, leadId, patch) {
  if (!isRuntimeStatePostgresEnabled(companyId) || !leadId) {
    return null;
  }

  const result = await query(
    `
      insert into lead_runtime_patches (
        company_id,
        lead_id,
        patch,
        updated_at
      )
      values ($1, $2, $3::jsonb, now())
      on conflict (company_id, lead_id)
      do update set
        patch = excluded.patch,
        updated_at = now()
      returning *
    `,
    [companyId, String(leadId), JSON.stringify(patch || {})]
  );

  return normalizeLeadRuntimePatchRow(result.rows[0]);
}

export async function listTelegramRegistrationStatesFromDb(companyId) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return [];
  }

  const result = await query(
    `
      select *
      from telegram_registration_states
      where company_id = $1
      order by updated_at desc, created_at desc
    `,
    [companyId]
  );

  return result.rows.map(normalizeTelegramRegistrationStateRow).filter(Boolean);
}

export async function upsertTelegramRegistrationStateInDb(companyId, chatId, payload) {
  if (!isRuntimeStatePostgresEnabled(companyId) || !chatId) {
    return null;
  }

  const result = await query(
    `
      insert into telegram_registration_states (
        company_id,
        chat_id,
        payload,
        updated_at
      )
      values ($1, $2, $3::jsonb, now())
      on conflict (company_id, chat_id)
      do update set
        payload = excluded.payload,
        updated_at = now()
      returning *
    `,
    [companyId, String(chatId), JSON.stringify(payload || {})]
  );

  return normalizeTelegramRegistrationStateRow(result.rows[0]);
}

export async function deleteTelegramRegistrationStateInDb(companyId, chatId) {
  if (!isRuntimeStatePostgresEnabled(companyId) || !chatId) {
    return;
  }

  await query(
    `
      delete from telegram_registration_states
      where company_id = $1
        and chat_id = $2
    `,
    [companyId, String(chatId)]
  );
}

export async function listTelegramDispatchLogsFromDb(companyId) {
  if (!isRuntimeStatePostgresEnabled(companyId)) {
    return [];
  }

  const result = await query(
    `
      select *
      from telegram_dispatch_logs
      where company_id = $1
      order by updated_at desc, sent_at desc
    `,
    [companyId]
  );

  return result.rows.map(normalizeTelegramDispatchLogRow).filter(Boolean);
}

export async function upsertTelegramDispatchLogInDb(companyId, dispatchKey, sentAt = null) {
  if (!isRuntimeStatePostgresEnabled(companyId) || !dispatchKey) {
    return null;
  }

  const normalizedSentAt = normalizeRuntimeTimestamp(sentAt) || new Date().toISOString();
  const result = await query(
    `
      insert into telegram_dispatch_logs (
        company_id,
        dispatch_key,
        sent_at,
        updated_at
      )
      values ($1, $2, $3::timestamptz, now())
      on conflict (company_id, dispatch_key)
      do update set
        sent_at = excluded.sent_at,
        updated_at = now()
      returning *
    `,
    [companyId, String(dispatchKey), normalizedSentAt]
  );

  return normalizeTelegramDispatchLogRow(result.rows[0]);
}
