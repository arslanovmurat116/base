import { query } from "../db";
import {
  buildScenarioDraftTitle,
  normalizeScenarioDraftStatus
} from "../scenario-drafts";
import {
  getDemoStaffAlias,
  getLaunchClientDisplayName,
  getLaunchDealTitle
} from "./launch-aliases";

function normalizeIsoTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeMoneyAmount(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeLimit(value, fallback = 100) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(1, Math.min(numeric, 500));
}

function sanitizeDisplayText(value, fallback = "") {
  const text = String(value || fallback || "").replace(/Â·/g, "·").replace(/\s+/g, " ").trim();
  return text || fallback || "";
}

function normalizeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeJsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeCoreClientRow(row) {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    sourceLeadId: row.source_lead_id || null,
    owner: row.owner_user_id
      ? {
          id: row.owner_user_id,
          name: getDemoStaffAlias({ userId: row.owner_user_id, name: row.owner_name, fallback: "Unassigned" })
        }
      : null,
    displayName: getLaunchClientDisplayName({ sourceLeadId: row.source_lead_id, displayName: row.display_name }),
    primaryPhone: row.primary_phone || null,
    primaryEmail: row.primary_email || null,
    telegramUserId: row.telegram_user_id || null,
    telegramUsername: row.telegram_username || null,
    status: row.status || "PROSPECT",
    notes: row.notes || null,
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at),
    stats: {
      totalDeals: Number(row.total_deals || 0),
      openDeals: Number(row.open_deals || 0),
      wonDeals: Number(row.won_deals || 0)
    }
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
    owner: row.owner_user_id
      ? {
          id: row.owner_user_id,
          name: getDemoStaffAlias({ userId: row.owner_user_id, name: row.owner_name, fallback: "Unassigned" })
        }
      : null,
    title: getLaunchDealTitle({ leadId: row.lead_id, title: row.title, clientName: row.client_name }),
    pipelineKey: row.pipeline_key || "sales",
    stageKey: row.stage_key || "new",
    status: row.status || "OPEN",
    currency: row.currency || "KZT",
    amountEstimate: normalizeMoneyAmount(row.amount_estimate),
    closeTargetAt: normalizeIsoTimestamp(row.close_target_at),
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at),
    client: row.client_id
      ? {
          id: row.client_id,
          displayName: getLaunchClientDisplayName({ sourceLeadId: row.lead_id, displayName: row.client_name }),
          primaryPhone: row.client_phone || null
        }
      : null,
    sourceLeadId: row.lead_id || null
  };
}

function normalizeScenarioDraftRow(row) {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    source: row.source || "demo_page",
    telegramUserId: row.telegram_user_id || null,
    telegramUsername: row.telegram_username || null,
    chatId: row.chat_id || null,
    sessionId: row.session_id || null,
    title: sanitizeDisplayText(
      row.title,
      buildScenarioDraftTitle(row.raw_text || row.ai_summary || "Scenario request")
    ),
    description: sanitizeDisplayText(row.description, row.raw_text || ""),
    category: row.category || "other",
    targetPlatform: row.target_platform || "other",
    constraints: normalizeJsonArray(row.constraints_json),
    rawText: sanitizeDisplayText(row.raw_text, ""),
    aiSummary: sanitizeDisplayText(row.ai_summary, ""),
    suggestedTrigger: sanitizeDisplayText(row.suggested_trigger, ""),
    suggestedSteps: normalizeJsonArray(row.suggested_steps_json),
    suggestedEntities: normalizeJsonArray(row.suggested_entities_json),
    suggestedBotActions: normalizeJsonArray(row.suggested_bot_actions_json),
    suggestedMiniAppBlocks: normalizeJsonArray(row.suggested_miniapp_blocks_json),
    status: normalizeScenarioDraftStatus(row.status, "NEW"),
    metadata: normalizeJsonObject(row.metadata_json),
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at)
  };
}

export async function listCoreClientsFromDb(companyId, options = {}, executor = query) {
  if (!companyId) {
    return [];
  }

  const limit = normalizeLimit(options.limit, 100);

  const result = await executor(
    `
      select
        c.id,
        c.source_lead_id,
        c.owner_user_id,
        c.display_name,
        c.primary_phone,
        c.primary_email,
        c.telegram_user_id,
        c.telegram_username,
        c.status,
        c.notes,
        c.created_at,
        c.updated_at,
        coalesce(u.full_name, 'Unassigned') as owner_name,
        count(d.id)::int as total_deals,
        count(*) filter (where d.status = 'OPEN')::int as open_deals,
        count(*) filter (where d.status = 'CLOSED_WON')::int as won_deals
      from clients c
      left join users u on u.id = c.owner_user_id
      left join deals d
        on d.company_id = c.company_id
       and d.client_id = c.id
      where c.company_id = $1
      group by
        c.id,
        c.source_lead_id,
        c.owner_user_id,
        c.display_name,
        c.primary_phone,
        c.primary_email,
        c.telegram_user_id,
        c.telegram_username,
        c.status,
        c.notes,
        c.created_at,
        c.updated_at,
        u.full_name
      order by c.updated_at desc, c.created_at desc
      limit $2
    `,
    [companyId, limit]
  );

  return result.rows.map(normalizeCoreClientRow).filter(Boolean);
}

export async function listCoreDealsFromDb(companyId, options = {}, executor = query) {
  if (!companyId) {
    return [];
  }

  const limit = normalizeLimit(options.limit, 100);

  const result = await executor(
    `
      select
        d.id,
        d.lead_id,
        d.client_id,
        d.owner_user_id,
        d.title,
        d.pipeline_key,
        d.stage_key,
        d.status,
        d.currency,
        d.amount_estimate,
        d.close_target_at,
        d.created_at,
        d.updated_at,
        coalesce(u.full_name, 'Unassigned') as owner_name,
        c.display_name as client_name,
        c.primary_phone as client_phone
      from deals d
      left join users u on u.id = d.owner_user_id
      left join clients c on c.id = d.client_id
      where d.company_id = $1
      order by d.updated_at desc, d.created_at desc
      limit $2
    `,
    [companyId, limit]
  );

  return result.rows.map(normalizeCoreDealRow).filter(Boolean);
}

export async function getCoreClientByIdFromDb(companyId, clientId, executor = query) {
  if (!companyId || !clientId) {
    return null;
  }

  const result = await executor(
    `
      select
        c.id,
        c.source_lead_id,
        c.owner_user_id,
        c.display_name,
        c.primary_phone,
        c.primary_email,
        c.telegram_user_id,
        c.telegram_username,
        c.status,
        c.notes,
        c.created_at,
        c.updated_at,
        coalesce(u.full_name, 'Unassigned') as owner_name,
        count(d.id)::int as total_deals,
        count(*) filter (where d.status = 'OPEN')::int as open_deals,
        count(*) filter (where d.status = 'CLOSED_WON')::int as won_deals
      from clients c
      left join users u on u.id = c.owner_user_id
      left join deals d
        on d.company_id = c.company_id
       and d.client_id = c.id
      where c.company_id = $1
        and c.id = $2
      group by
        c.id,
        c.source_lead_id,
        c.owner_user_id,
        c.display_name,
        c.primary_phone,
        c.primary_email,
        c.telegram_user_id,
        c.telegram_username,
        c.status,
        c.notes,
        c.created_at,
        c.updated_at,
        u.full_name
      limit 1
    `,
    [companyId, clientId]
  );

  return normalizeCoreClientRow(result.rows[0]);
}

export async function getCoreDealByIdFromDb(companyId, dealId, executor = query) {
  if (!companyId || !dealId) {
    return null;
  }

  const result = await executor(
    `
      select
        d.id,
        d.lead_id,
        d.client_id,
        d.owner_user_id,
        d.title,
        d.pipeline_key,
        d.stage_key,
        d.status,
        d.currency,
        d.amount_estimate,
        d.close_target_at,
        d.created_at,
        d.updated_at,
        coalesce(u.full_name, 'Unassigned') as owner_name,
        c.display_name as client_name,
        c.primary_phone as client_phone
      from deals d
      left join users u on u.id = d.owner_user_id
      left join clients c on c.id = d.client_id
      where d.company_id = $1
        and d.id = $2
      limit 1
    `,
    [companyId, dealId]
  );

  return normalizeCoreDealRow(result.rows[0]);
}

export async function listBusinessEventsFromDb(companyId, options = {}, executor = query) {
  if (!companyId) {
    return [];
  }

  const limit = normalizeLimit(options.limit, 20);
  const result = await executor(
    `
      select
        id,
        aggregate_type,
        aggregate_id,
        event_name,
        actor_type,
        actor_id,
        channel,
        payload,
        occurred_at
      from business_events
      where company_id = $1
      order by occurred_at desc, created_at desc
      limit $2
    `,
    [companyId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventName: row.event_name,
    actorType: row.actor_type,
    actorId: row.actor_id || null,
    channel: row.channel || null,
    payload: row.payload || {},
    occurredAt: normalizeIsoTimestamp(row.occurred_at)
  }));
}

export async function loadCoreReadModelMapsByLeadIds(companyId, leadIds = [], executor = query) {
  if (!companyId || !Array.isArray(leadIds) || !leadIds.length) {
    return {
      clientsByLeadId: new Map(),
      dealsByLeadId: new Map()
    };
  }

  const clientsResult = await executor(
    `
      select
        c.id,
        c.source_lead_id,
        c.owner_user_id,
        c.display_name,
        c.primary_phone,
        c.primary_email,
        c.telegram_user_id,
        c.telegram_username,
        c.status,
        c.notes,
        c.created_at,
        c.updated_at,
        coalesce(u.full_name, 'Unassigned') as owner_name,
        count(d.id)::int as total_deals,
        count(*) filter (where d.status = 'OPEN')::int as open_deals,
        count(*) filter (where d.status = 'CLOSED_WON')::int as won_deals
      from clients c
      left join users u on u.id = c.owner_user_id
      left join deals d
        on d.company_id = c.company_id
       and d.client_id = c.id
      where c.company_id = $1
        and c.source_lead_id = any($2::uuid[])
      group by
        c.id,
        c.source_lead_id,
        c.owner_user_id,
        c.display_name,
        c.primary_phone,
        c.primary_email,
        c.telegram_user_id,
        c.telegram_username,
        c.status,
        c.notes,
        c.created_at,
        c.updated_at,
        u.full_name
      order by c.updated_at desc, c.created_at desc
    `,
    [companyId, leadIds]
  );

  const dealsResult = await executor(
    `
      select
        d.id,
        d.lead_id,
        d.client_id,
        d.owner_user_id,
        d.title,
        d.pipeline_key,
        d.stage_key,
        d.status,
        d.currency,
        d.amount_estimate,
        d.close_target_at,
        d.created_at,
        d.updated_at,
        coalesce(u.full_name, 'Unassigned') as owner_name,
        c.display_name as client_name,
        c.primary_phone as client_phone
      from deals d
      left join users u on u.id = d.owner_user_id
      left join clients c on c.id = d.client_id
      where d.company_id = $1
        and d.lead_id = any($2::uuid[])
      order by d.updated_at desc, d.created_at desc
    `,
    [companyId, leadIds]
  );

  return {
    clientsByLeadId: new Map(
      clientsResult.rows
        .map((row) => [row.source_lead_id, normalizeCoreClientRow(row)])
        .filter((entry) => entry[0] && entry[1])
    ),
    dealsByLeadId: new Map(
      dealsResult.rows
        .map((row) => [row.lead_id, normalizeCoreDealRow(row)])
        .filter((entry) => entry[0] && entry[1])
    )
  };
}

export async function listScenarioDraftsFromDb(companyId, options = {}, executor = query) {
  if (!companyId) {
    return [];
  }

  const limit = normalizeLimit(options.limit, 100);
  const normalizedStatus = options.status
    ? normalizeScenarioDraftStatus(options.status, null)
    : null;
  const params = [companyId];
  const where = ["company_id = $1"];

  if (normalizedStatus) {
    params.push(normalizedStatus);
    where.push(`upper(status) = upper($${params.length})`);
  }

  params.push(limit);
  const result = await executor(
    `
      select
        id,
        source,
        telegram_user_id,
        telegram_username,
        chat_id,
        session_id,
        title,
        description,
        category,
        target_platform,
        constraints_json,
        raw_text,
        ai_summary,
        suggested_trigger,
        suggested_steps_json,
        suggested_entities_json,
        suggested_bot_actions_json,
        suggested_miniapp_blocks_json,
        status,
        metadata_json,
        created_at,
        updated_at
      from scenario_drafts
      where ${where.join(" and ")}
      order by updated_at desc, created_at desc
      limit $${params.length}
    `,
    params
  );

  return result.rows.map(normalizeScenarioDraftRow).filter(Boolean);
}

export async function getScenarioDraftByIdFromDb(companyId, draftId, executor = query) {
  if (!companyId || !draftId) {
    return null;
  }

  const result = await executor(
    `
      select
        id,
        source,
        telegram_user_id,
        telegram_username,
        chat_id,
        session_id,
        title,
        description,
        category,
        target_platform,
        constraints_json,
        raw_text,
        ai_summary,
        suggested_trigger,
        suggested_steps_json,
        suggested_entities_json,
        suggested_bot_actions_json,
        suggested_miniapp_blocks_json,
        status,
        metadata_json,
        created_at,
        updated_at
      from scenario_drafts
      where company_id = $1
        and id = $2
      limit 1
    `,
    [companyId, draftId]
  );

  return normalizeScenarioDraftRow(result.rows[0]);
}
