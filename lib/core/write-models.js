import { isLiveDatabaseEnabled, query } from "../db";
import { appendBusinessEvent, buildBusinessEvent } from "./business-events";

function getCompanyId() {
  return process.env.DISET_DEFAULT_COMPANY_ID || null;
}

function normalizeText(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function normalizeTelegramUsername(value) {
  const trimmed = normalizeText(value);
  return trimmed ? `@${trimmed.replace(/^@+/, "")}` : null;
}

function normalizeAmount(value) {
  const cleaned = String(value ?? "")
    .replace(/[^\d.,-]+/g, "")
    .replace(",", ".");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeIsoTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCoreClientRow(row) {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    sourceLeadId: row.source_lead_id || null,
    ownerUserId: row.owner_user_id || null,
    displayName: row.display_name || "Client",
    primaryPhone: row.primary_phone || null,
    primaryEmail: row.primary_email || null,
    telegramUserId: row.telegram_user_id || null,
    telegramUsername: row.telegram_username || null,
    status: row.status || "PROSPECT",
    notes: row.notes || null,
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at)
  };
}

function normalizeCoreDealRow(row) {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    leadId: row.lead_id || null,
    clientId: row.client_id || null,
    ownerUserId: row.owner_user_id || null,
    title: row.title || "Deal",
    pipelineKey: row.pipeline_key || "sales",
    stageKey: row.stage_key || "new",
    status: row.status || "OPEN",
    currency: row.currency || "KZT",
    amountEstimate: row.amount_estimate == null ? null : Number(row.amount_estimate),
    closeTargetAt: normalizeIsoTimestamp(row.close_target_at),
    payload: row.payload || {},
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at)
  };
}

function normalizeBotRequestRow(row) {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    scenarioId: row.scenario_id,
    requestType: row.request_type,
    status: row.status || "NEW",
    sourceChannel: row.source_channel || "telegram",
    telegramUserId: row.telegram_user_id || null,
    chatId: row.chat_id || null,
    telegramUsername: row.telegram_username || null,
    subjectType: row.subject_type || "telegram_user",
    subjectId: row.subject_id || null,
    coreUserId: row.core_user_id || null,
    coreClientId: row.core_client_id || null,
    relatedLeadId: row.related_lead_id || null,
    relatedDealId: row.related_deal_id || null,
    title: row.title || "Request",
    content: row.content || null,
    aiSummary: row.ai_summary || null,
    aiNextAction: row.ai_next_action || null,
    taskId: row.task_id || null,
    payload: row.payload || {},
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at)
  };
}

async function resolveUserIdByName(companyId, fullName, executor = query) {
  const normalizedName = normalizeText(fullName);

  if (!companyId || !normalizedName) {
    return null;
  }

  const result = await executor(
    `
      select id
      from users
      where company_id = $1
        and full_name = $2
      limit 1
    `,
    [companyId, normalizedName]
  );

  return result.rows[0]?.id || null;
}

export async function findCoreClientByReferenceInDb(
  companyId = getCompanyId(),
  reference,
  executor = query
) {
  const normalizedReference = normalizeText(reference);
  const normalizedUsername = normalizeTelegramUsername(reference);

  if (!companyId || !normalizedReference || !isLiveDatabaseEnabled()) {
    return null;
  }

  const result = await executor(
    `
      select *
      from clients
      where company_id = $1
        and (
          id::text = $2
          or lower(display_name) = lower($2)
          or primary_phone = $2
          or lower(coalesce(telegram_username, '')) = lower($3)
        )
      order by updated_at desc, created_at desc
      limit 1
    `,
    [companyId, normalizedReference, normalizedUsername]
  );

  return normalizeCoreClientRow(result.rows[0]);
}

export async function findCoreDealByReferenceInDb(
  companyId = getCompanyId(),
  reference,
  executor = query
) {
  const normalizedReference = normalizeText(reference);

  if (!companyId || !normalizedReference || !isLiveDatabaseEnabled()) {
    return null;
  }

  const result = await executor(
    `
      select *
      from deals
      where company_id = $1
        and (
          id::text = $2
          or lower(title) = lower($2)
        )
      order by updated_at desc, created_at desc
      limit 1
    `,
    [companyId, normalizedReference]
  );

  return normalizeCoreDealRow(result.rows[0]);
}

export async function createCoreClientRecord(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();
  const displayName = normalizeText(payload.displayName || payload.name);
  const primaryPhone = normalizeText(payload.primaryPhone || payload.phone);
  const primaryEmail = normalizeText(payload.primaryEmail || payload.email);
  const telegramUserId = normalizeText(payload.telegramUserId);
  const telegramUsername = normalizeTelegramUsername(payload.telegramUsername || payload.username);
  const notes = normalizeText(payload.notes);
  const status = normalizeText(payload.status) || "PROSPECT";

  if (!companyId || !displayName || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      mode: isLiveDatabaseEnabled() ? "live" : "mock",
      message: "Core client creation is not available.",
      client: null
    };
  }

  const existing = await executor(
    `
      select *
      from clients
      where company_id = $1
        and (
          ($2::text is not null and primary_phone = $2)
          or ($3::text is not null and telegram_user_id = $3)
          or ($4::text is not null and lower(coalesce(telegram_username, '')) = lower($4))
          or lower(display_name) = lower($5)
        )
      order by updated_at desc, created_at desc
      limit 1
    `,
    [companyId, primaryPhone, telegramUserId, telegramUsername, displayName]
  );

  if (existing.rows[0]?.id) {
    return {
      ok: true,
      mode: "live",
      created: false,
      message: "Client already exists in BOSE.",
      client: normalizeCoreClientRow(existing.rows[0])
    };
  }

  const ownerUserId = await resolveUserIdByName(companyId, payload.ownerName, executor);
  const result = await executor(
    `
      insert into clients (
        company_id,
        owner_user_id,
        display_name,
        primary_phone,
        primary_email,
        telegram_user_id,
        telegram_username,
        status,
        notes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
    `,
    [
      companyId,
      ownerUserId,
      displayName,
      primaryPhone,
      primaryEmail,
      telegramUserId,
      telegramUsername,
      status,
      notes
    ]
  );

  const client = normalizeCoreClientRow(result.rows[0]);
  await appendBusinessEvent(
    buildBusinessEvent({
      companyId,
      aggregateType: "client",
      aggregateId: client.id,
      eventName: "ClientCreated",
      actorType: payload.actorType || "system",
      actorId: payload.actorId || null,
      channel: payload.channel || "telegram",
      payload: {
        displayName: client.displayName,
        primaryPhone: client.primaryPhone,
        scenarioId: payload.scenarioId || null
      }
    }),
    executor
  );

  return {
    ok: true,
    mode: "live",
    created: true,
    message: "Client created in BOSE.",
    client
  };
}

export async function createCoreDealRecord(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();
  const title = normalizeText(payload.title);
  const clientId = normalizeText(payload.clientId);
  const clientReference = normalizeText(payload.clientReference);

  if (!companyId || !title || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      mode: isLiveDatabaseEnabled() ? "live" : "mock",
      message: "Core deal creation is not available.",
      deal: null
    };
  }

  const client =
    (clientId ? await findCoreClientByReferenceInDb(companyId, clientId, executor) : null) ||
    (clientReference
      ? await findCoreClientByReferenceInDb(companyId, clientReference, executor)
      : null);

  if (!client?.id) {
    return {
      ok: false,
      mode: "live",
      message: "Client not found for the deal."
    };
  }

  const existing = await executor(
    `
      select *
      from deals
      where company_id = $1
        and client_id = $2
        and lower(title) = lower($3)
        and status = 'OPEN'
      order by updated_at desc, created_at desc
      limit 1
    `,
    [companyId, client.id, title]
  );

  if (existing.rows[0]?.id) {
    return {
      ok: true,
      mode: "live",
      created: false,
      message: "Deal already exists in BOSE.",
      deal: normalizeCoreDealRow(existing.rows[0]),
      client
    };
  }

  const ownerUserId = await resolveUserIdByName(companyId, payload.ownerName, executor);
  const result = await executor(
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
        currency,
        amount_estimate,
        close_target_at,
        payload
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9, $10::timestamptz, $11::jsonb)
      returning *
    `,
    [
      companyId,
      payload.leadId || client.sourceLeadId || null,
      client.id,
      ownerUserId || client.ownerUserId || null,
      title,
      normalizeText(payload.pipelineKey) || "sales",
      normalizeText(payload.stageKey) || "new",
      normalizeText(payload.currency) || "KZT",
      normalizeAmount(payload.amountEstimate),
      normalizeIsoTimestamp(payload.closeTargetAt),
      JSON.stringify({
        scenarioId: payload.scenarioId || null,
        note: normalizeText(payload.note),
        createdFrom: payload.channel || "telegram"
      })
    ]
  );

  const deal = normalizeCoreDealRow(result.rows[0]);
  await appendBusinessEvent(
    buildBusinessEvent({
      companyId,
      aggregateType: "deal",
      aggregateId: deal.id,
      eventName: "DealCreated",
      actorType: payload.actorType || "system",
      actorId: payload.actorId || null,
      channel: payload.channel || "telegram",
      payload: {
        clientId: client.id,
        leadId: deal.leadId,
        title: deal.title,
        scenarioId: payload.scenarioId || null
      }
    }),
    executor
  );

  return {
    ok: true,
    mode: "live",
    created: true,
    message: "Deal created in BOSE.",
    deal,
    client
  };
}

function mapBotRequestEventName(requestType) {
  switch (String(requestType || "").toUpperCase()) {
    case "CUSTOMER_FEEDBACK":
      return "CustomerFeedbackSubmitted";
    case "FEATURE_REQUEST":
      return "FeatureRequestSubmitted";
    case "SUPPORT_REQUEST":
      return "SupportRequestSubmitted";
    case "FILE_INTAKE":
      return "FileIntakeSubmitted";
    default:
      return "BotRequestSubmitted";
  }
}

export async function createTelegramBotRequestRecord(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();
  const title = normalizeText(payload.title);
  const content = normalizeText(payload.content);

  if (!companyId || !title || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      mode: isLiveDatabaseEnabled() ? "live" : "mock",
      message: "Bot request storage is not available.",
      request: null
    };
  }

  const result = await executor(
    `
      insert into telegram_bot_requests (
        company_id,
        scenario_id,
        request_type,
        status,
        source_channel,
        telegram_user_id,
        chat_id,
        telegram_username,
        subject_type,
        subject_id,
        core_user_id,
        core_client_id,
        related_lead_id,
        related_deal_id,
        title,
        content,
        ai_summary,
        ai_next_action,
        task_id,
        payload
      )
      values (
        $1, $2, $3, coalesce($4, 'NEW'), coalesce($5, 'telegram'),
        $6, $7, $8, coalesce($9, 'telegram_user'), $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20::jsonb
      )
      returning *
    `,
    [
      companyId,
      normalizeText(payload.scenarioId),
      normalizeText(payload.requestType) || "BOT_REQUEST",
      normalizeText(payload.status),
      normalizeText(payload.sourceChannel),
      normalizeText(payload.telegramUserId),
      normalizeText(payload.chatId),
      normalizeTelegramUsername(payload.telegramUsername || payload.username),
      normalizeText(payload.subjectType),
      normalizeText(payload.subjectId),
      normalizeText(payload.coreUserId),
      normalizeText(payload.coreClientId),
      normalizeText(payload.relatedLeadId),
      normalizeText(payload.relatedDealId),
      title,
      content,
      normalizeText(payload.aiSummary),
      normalizeText(payload.aiNextAction),
      normalizeText(payload.taskId),
      JSON.stringify(payload.payload || {})
    ]
  );

  const request = normalizeBotRequestRow(result.rows[0]);
  await appendBusinessEvent(
    buildBusinessEvent({
      companyId,
      aggregateType: "bot_request",
      aggregateId: request.id,
      eventName: mapBotRequestEventName(request.requestType),
      actorType: payload.actorType || "system",
      actorId: payload.actorId || null,
      channel: payload.channel || "telegram",
      payload: {
        scenarioId: request.scenarioId,
        requestType: request.requestType,
        taskId: request.taskId,
        relatedLeadId: request.relatedLeadId,
        relatedDealId: request.relatedDealId
      }
    }),
    executor
  );

  return {
    ok: true,
    mode: "live",
    created: true,
    message: "Bot request stored in BOSE.",
    request
  };
}
