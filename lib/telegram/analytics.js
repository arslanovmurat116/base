import crypto from "node:crypto";
import { isLiveDatabaseEnabled, query } from "../db";
import { resolveMiniAppSubject } from "./miniapp-auth";

const TELEGRAM_ANALYTICS_EVENTS = Object.freeze([
  "first_open",
  "first_start",
  "app_open",
  "session_start",
  "session_end",
  "screen_view",
  "button_click",
  "registration_completed",
  "lead_created",
  "client_created",
  "deal_created",
  "ai_used",
  "demo_scenario_started",
  "demo_category_selected",
  "scenario_draft_created",
  "scenario_draft_failed",
  "invite_used",
  "referral_used"
]);

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

function normalizeBoolean(value) {
  return value === true;
}

function normalizeIsoTimestamp(value, fallback = new Date().toISOString()) {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function getActiveDayKey(value) {
  return normalizeIsoTimestamp(value).slice(0, 10);
}

function getDaysBetweenTimestamps(fromValue, toValue = new Date().toISOString()) {
  if (!fromValue) {
    return 0;
  }

  const fromDate = new Date(fromValue);
  const toDate = new Date(toValue);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000));
}

function buildRetentionState(previousSeenAt, currentSeenAt) {
  if (!previousSeenAt) {
    return "new";
  }

  const previous = new Date(previousSeenAt);
  const current = new Date(currentSeenAt);
  const diffDays = Math.floor((current.getTime() - previous.getTime()) / 86400000);

  if (diffDays >= 30) {
    return "revived_30d";
  }

  if (diffDays >= 7) {
    return "revived_7d";
  }

  if (diffDays >= 1) {
    return "returned";
  }

  return "active";
}

function hashInitData(value) {
  const raw = String(value || "").trim();
  return raw ? crypto.createHash("sha256").update(raw).digest("hex") : null;
}

function normalizeJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function calculateLifecycleStage(profile = {}, currentTimestamp = new Date().toISOString()) {
  const inactivityDays = getDaysBetweenTimestamps(profile.lastSeenAt, currentTimestamp);
  const totalLaunches =
    Number(profile.launchCount || 0) +
    Number(profile.botLaunchCount || 0) +
    Number(profile.miniappLaunchCount || 0);
  const activeDaysCount = Number(profile.activeDaysCount || 0);
  const sessionCount = Number(profile.sessionCount || 0);

  if (inactivityDays >= 30) {
    return "inactive";
  }

  if (inactivityDays >= 7) {
    return "dormant";
  }

  if (activeDaysCount >= 3 || sessionCount >= 2 || totalLaunches >= 4) {
    return "engaged";
  }

  if (sessionCount >= 1 || totalLaunches >= 2) {
    return "activated";
  }

  return "new";
}

function addDaysToTimestamp(value, days) {
  const date = new Date(normalizeIsoTimestamp(value));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function buildRetentionPlans(profile = {}, currentTimestamp = new Date().toISOString()) {
  const lastSeenAt = profile.lastSeenAt || currentTimestamp;
  const lifecycleStage = calculateLifecycleStage(profile, currentTimestamp);

  return [
    {
      campaignType: "day_1_return",
      scheduledAt: addDaysToTimestamp(lastSeenAt, 1),
      lifecycleStage,
      status: "scheduled",
      payload: {
        triggerAfterDays: 1,
        kind: "return",
        surface: "telegram"
      }
    },
    {
      campaignType: "day_7_return",
      scheduledAt: addDaysToTimestamp(lastSeenAt, 7),
      lifecycleStage,
      status: "scheduled",
      payload: {
        triggerAfterDays: 7,
        kind: "return",
        surface: "telegram"
      }
    },
    {
      campaignType: "inactive_recovery",
      scheduledAt: addDaysToTimestamp(lastSeenAt, 14),
      lifecycleStage,
      status: "scheduled",
      payload: {
        triggerAfterDays: 14,
        kind: "recovery",
        surface: "telegram"
      }
    }
  ];
}

function normalizeProfileRow(row) {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.company_id,
    subjectType: row.subject_type || "telegram_user",
    subjectId: row.subject_id || null,
    coreUserId: row.core_user_id || null,
    coreClientId: row.core_client_id || null,
    telegramUserId: row.telegram_user_id || null,
    chatId: row.chat_id || null,
    username: row.telegram_username || null,
    firstName: row.first_name || null,
    lastName: row.last_name || null,
    languageCode: row.language_code || null,
    isPremium: Boolean(row.is_premium),
    botStartedAt: row.bot_started_at || null,
    miniappStartedAt: row.miniapp_started_at || null,
    firstSeenAt: row.first_seen_at || null,
    lastSeenAt: row.last_seen_at || null,
    firstStartAt: row.first_start_at || null,
    lastStartAt: row.last_start_at || null,
    firstOpenAt: row.first_open_at || null,
    lastOpenAt: row.last_open_at || null,
    launchCount: Number(row.launch_count || 0),
    botLaunchCount: Number(row.bot_launch_count || 0),
    miniappLaunchCount: Number(row.miniapp_launch_count || 0),
    sessionCount: Number(row.session_count || 0),
    activeDaysCount: Number(row.active_days_count || 0),
    lastActiveDay: row.last_active_day || null,
    lastActivityAt: row.last_activity_at || null,
    lastActivityKind: row.last_activity_kind || null,
    retentionState: row.retention_state || "new",
    lifecycleStage: row.lifecycle_stage || "new",
    nextReengagementAt: row.next_reengagement_at || null,
    reengagementStatus: row.reengagement_status || "idle",
    lastReengagementAt: row.last_reengagement_at || null,
    metadata: row.metadata || {}
  };
}

function normalizeSessionRow(row) {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    sessionToken: row.session_token,
    profileId: row.profile_id || null,
    companyId: row.company_id || null,
    subjectType: row.subject_type || "telegram_user",
    subjectId: row.subject_id || null,
    telegramUserId: row.telegram_user_id || null,
    telegramUsername: row.telegram_username || null,
    chatId: row.chat_id || null,
    startedAt: row.started_at || row.issued_at || null,
    endedAt: row.ended_at || null,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    device: row.device || null,
    platform: row.platform || null,
    telegramVersion: row.telegram_version || null,
    initDataHash: row.init_data_hash || null,
    appVersion: row.app_version || null,
    languageCode: row.language_code || null,
    screenPath: row.screen_path || null,
    status: row.session_status || "ACTIVE",
    expiresAt: row.expires_at || null,
    payload: row.payload || {}
  };
}

function buildEventKey(eventName, payload = {}) {
  if (payload.eventKey) {
    return payload.eventKey;
  }

  if (payload.sessionId && ["app_open", "session_start", "session_end"].includes(eventName)) {
    return `${eventName}:${payload.sessionId}`;
  }

  if (payload.profileId && ["first_open", "first_start"].includes(eventName)) {
    return `${eventName}:${payload.profileId}`;
  }

  if (payload.profileId && payload.startParam && ["invite_used", "referral_used"].includes(eventName)) {
    return `${eventName}:${payload.profileId}:${payload.startParam}`;
  }

  return null;
}

function shouldTrackReferral(startParam) {
  const normalized = String(startParam || "").trim().toLowerCase();
  return normalized.startsWith("ref") || normalized.includes("referral") || normalized.includes("invite");
}

async function resolveExistingTelegramIdentity(companyId, telegramUserId, executor = query) {
  if (!companyId || !telegramUserId) {
    return null;
  }

  const result = await executor(
    `
      select *
      from telegram_identities
      where company_id = $1
        and telegram_user_id = $2::text
      limit 1
    `,
    [companyId, String(telegramUserId)]
  );

  return normalizeProfileRow(result.rows[0]);
}

async function resolveSubjectForTelegramIdentity(companyId, payload = {}, executor = query) {
  if (payload.subjectType && payload.subjectId) {
    return {
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      role: payload.role || null,
      companyId,
      coreUserId: payload.subjectType === "user" ? payload.subjectId : null,
      coreClientId: payload.subjectType === "client" ? payload.subjectId : null
    };
  }

  if (!payload.telegramUserId) {
    return {
      subjectType: "telegram_user",
      subjectId: "unknown",
      companyId,
      coreUserId: null,
      coreClientId: null
    };
  }

  const candidate = {
    telegramUserId: String(payload.telegramUserId),
    telegramUsername: normalizeTelegramUsername(payload.username || payload.telegramUsername),
    displayName: [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim() || payload.username || "Telegram user",
    languageCode: payload.languageCode || null,
    allowsWriteToPm: normalizeBoolean(payload.allowsWriteToPm),
    startParam: payload.startParam || null
  };
  const subject = await resolveMiniAppSubject(candidate);

  return {
    ...subject,
    coreUserId: subject.subjectType === "user" ? subject.subjectId : null,
    coreClientId: subject.subjectType === "client" ? subject.subjectId : null
  };
}

export function getTelegramAnalyticsFoundationStatus() {
  const appUrl = normalizeText(process.env.APP_BASE_URL);

  return {
    enabled: Boolean(getCompanyId() && isLiveDatabaseEnabled()),
    appUrl,
    appUrlReady: Boolean(appUrl && /^https:\/\//i.test(appUrl)),
    trackedEvents: [...TELEGRAM_ANALYTICS_EVENTS]
  };
}

async function syncTelegramLifecycleFoundation(profile, executor = query) {
  if (!profile?.id || !profile.companyId || !isLiveDatabaseEnabled()) {
    return {
      profile,
      campaigns: []
    };
  }

  const currentTimestamp = profile.lastSeenAt || new Date().toISOString();
  const lifecycleStage = calculateLifecycleStage(profile, currentTimestamp);
  const plans = buildRetentionPlans(
    {
      ...profile,
      lifecycleStage
    },
    currentTimestamp
  );
  const nextReengagementAt = plans
    .map((item) => item.scheduledAt)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] || null;
  const reengagementStatus = "scheduled";
  const updatedProfileResult = await executor(
    `
      update telegram_identities
      set
        lifecycle_stage = $2,
        next_reengagement_at = $3::timestamptz,
        reengagement_status = $4,
        updated_at = now()
      where id = $1
      returning *
    `,
    [profile.id, lifecycleStage, nextReengagementAt, reengagementStatus]
  );
  const normalizedProfile = normalizeProfileRow(updatedProfileResult.rows[0] || profile);

  const campaigns = [];

  for (const plan of plans) {
    const campaignResult = await executor(
      `
        insert into telegram_retention_campaigns (
          company_id,
          profile_id,
          campaign_type,
          lifecycle_stage,
          status,
          scheduled_at,
          last_activity_at,
          last_evaluated_at,
          campaign_payload,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, now(), $8::jsonb, now()
        )
        on conflict (company_id, profile_id, campaign_type)
        do update set
          lifecycle_stage = excluded.lifecycle_stage,
          status = excluded.status,
          scheduled_at = excluded.scheduled_at,
          last_activity_at = excluded.last_activity_at,
          last_evaluated_at = now(),
          campaign_payload = excluded.campaign_payload,
          updated_at = now()
        returning id, campaign_type, status, scheduled_at, lifecycle_stage
      `,
      [
        normalizedProfile.companyId,
        normalizedProfile.id,
        plan.campaignType,
        plan.lifecycleStage,
        plan.status,
        plan.scheduledAt,
        normalizedProfile.lastActivityAt || currentTimestamp,
        JSON.stringify(plan.payload)
      ]
    );

    campaigns.push(campaignResult.rows[0]);
  }

  return {
    profile: normalizedProfile,
    campaigns
  };
}

export async function upsertTelegramIdentity(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();
  const telegramUserId = normalizeText(payload.telegramUserId);

  if (!companyId || !telegramUserId || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      skipped: true,
      reason: "telegram_identity_not_available"
    };
  }

  const existing = await resolveExistingTelegramIdentity(companyId, telegramUserId, executor);
  const subject = await resolveSubjectForTelegramIdentity(companyId, payload, executor);
  const timestamp = normalizeIsoTimestamp(payload.timestamp);
  const lastActiveDay = getActiveDayKey(timestamp);
  const isNewActiveDay = !existing || existing.lastActiveDay !== lastActiveDay;
  const retentionState = buildRetentionState(existing?.lastSeenAt, timestamp);
  const activityKind = normalizeText(payload.activityKind) || "telegram_touch";
  const isFirstStart = Boolean(payload.botStarted) && !existing?.firstStartAt;
  const isFirstOpen = Boolean(payload.appOpen) && !existing?.firstOpenAt;
  const isFirstSeen = !existing;
  const nextProfile = {
    subjectType: subject.subjectType || existing?.subjectType || "telegram_user",
    subjectId: subject.subjectId || existing?.subjectId || telegramUserId,
    coreUserId: subject.coreUserId || existing?.coreUserId || null,
    coreClientId: subject.coreClientId || existing?.coreClientId || null,
    chatId: normalizeText(payload.chatId) || existing?.chatId || null,
    username:
      normalizeTelegramUsername(payload.username || payload.telegramUsername) ||
      existing?.username ||
      null,
    firstName: normalizeText(payload.firstName) || existing?.firstName || null,
    lastName: normalizeText(payload.lastName) || existing?.lastName || null,
    languageCode: normalizeText(payload.languageCode) || existing?.languageCode || null,
    isPremium: payload.isPremium == null ? existing?.isPremium || false : normalizeBoolean(payload.isPremium),
    botStartedAt: payload.botStarted ? existing?.botStartedAt || timestamp : existing?.botStartedAt || null,
    miniappStartedAt:
      payload.appOpen || payload.miniappStarted
        ? existing?.miniappStartedAt || timestamp
        : existing?.miniappStartedAt || null,
    firstSeenAt: existing?.firstSeenAt || timestamp,
    lastSeenAt: timestamp,
    firstStartAt: payload.botStarted ? existing?.firstStartAt || timestamp : existing?.firstStartAt || null,
    lastStartAt: payload.botStarted ? timestamp : existing?.lastStartAt || null,
    firstOpenAt: payload.appOpen ? existing?.firstOpenAt || timestamp : existing?.firstOpenAt || null,
    lastOpenAt: payload.appOpen ? timestamp : existing?.lastOpenAt || null,
    launchCount: Number(existing?.launchCount || 0) + (payload.incrementLaunch || payload.botStarted ? 1 : 0),
    botLaunchCount: Number(existing?.botLaunchCount || 0) + (payload.botStarted ? 1 : 0),
    miniappLaunchCount: Number(existing?.miniappLaunchCount || 0) + (payload.appOpen ? 1 : 0),
    sessionCount: Number(existing?.sessionCount || 0) + (payload.incrementSession ? 1 : 0),
    activeDaysCount: Number(existing?.activeDaysCount || 0) + (isNewActiveDay ? 1 : 0),
    lastActiveDay,
    lastActivityAt: timestamp,
    lastActivityKind: activityKind,
    retentionState,
    lifecycleStage: existing?.lifecycleStage || "new",
    nextReengagementAt: existing?.nextReengagementAt || null,
    reengagementStatus: existing?.reengagementStatus || "idle",
    lastReengagementAt: existing?.lastReengagementAt || null,
    metadata: {
      ...(existing?.metadata || {}),
      ...normalizeJson(payload.metadata)
    }
  };

  const updateSql = `
        update telegram_identities
        set
          subject_type = $3,
          subject_id = $4,
          core_user_id = $5,
          core_client_id = $6,
          chat_id = $7,
          telegram_username = $8,
          first_name = $9,
          last_name = $10,
          language_code = $11,
          is_premium = $12,
          bot_started_at = $13::timestamptz,
          miniapp_started_at = $14::timestamptz,
          first_seen_at = $15::timestamptz,
          last_seen_at = $16::timestamptz,
          first_start_at = $17::timestamptz,
          last_start_at = $18::timestamptz,
          first_open_at = $19::timestamptz,
          last_open_at = $20::timestamptz,
          launch_count = $21,
          bot_launch_count = $22,
          miniapp_launch_count = $23,
          session_count = $24,
          active_days_count = $25,
          last_active_day = $26::date,
          last_activity_at = $27::timestamptz,
          last_activity_kind = $28,
          retention_state = $29,
          lifecycle_stage = $30,
          next_reengagement_at = $31::timestamptz,
          reengagement_status = $32,
          last_reengagement_at = $33::timestamptz,
          metadata = $34::jsonb,
          updated_at = now()
        where id = $1
          and company_id = $2
        returning *
      `;
  const insertSql = `
        insert into telegram_identities (
          company_id,
          telegram_user_id,
          subject_type,
          subject_id,
          core_user_id,
          core_client_id,
          chat_id,
          telegram_username,
          first_name,
          last_name,
          language_code,
          is_premium,
          bot_started_at,
          miniapp_started_at,
          first_seen_at,
          last_seen_at,
          first_start_at,
          last_start_at,
          first_open_at,
          last_open_at,
          launch_count,
          bot_launch_count,
          miniapp_launch_count,
          session_count,
          active_days_count,
          last_active_day,
          last_activity_at,
          last_activity_kind,
          retention_state,
          lifecycle_stage,
          next_reengagement_at,
          reengagement_status,
          last_reengagement_at,
          metadata
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13::timestamptz, $14::timestamptz, $15::timestamptz, $16::timestamptz,
          $17::timestamptz, $18::timestamptz, $19::timestamptz, $20::timestamptz,
          $21, $22, $23, $24, $25, $26::date, $27::timestamptz, $28, $29,
          $30, $31::timestamptz, $32, $33::timestamptz, $34::jsonb
        )
        returning *
      `;

  const updateParams = [
    existing?.id,
    companyId,
    nextProfile.subjectType,
    nextProfile.subjectId,
    nextProfile.coreUserId,
    nextProfile.coreClientId,
    nextProfile.chatId,
    nextProfile.username,
    nextProfile.firstName,
    nextProfile.lastName,
    nextProfile.languageCode,
    nextProfile.isPremium,
    nextProfile.botStartedAt,
    nextProfile.miniappStartedAt,
    nextProfile.firstSeenAt,
    nextProfile.lastSeenAt,
    nextProfile.firstStartAt,
    nextProfile.lastStartAt,
    nextProfile.firstOpenAt,
    nextProfile.lastOpenAt,
    nextProfile.launchCount,
    nextProfile.botLaunchCount,
    nextProfile.miniappLaunchCount,
    nextProfile.sessionCount,
    nextProfile.activeDaysCount,
    nextProfile.lastActiveDay,
    nextProfile.lastActivityAt,
    nextProfile.lastActivityKind,
    nextProfile.retentionState,
    nextProfile.lifecycleStage,
    nextProfile.nextReengagementAt,
    nextProfile.reengagementStatus,
    nextProfile.lastReengagementAt,
    JSON.stringify(nextProfile.metadata)
  ];
  const insertParams = [
    companyId,
    telegramUserId,
    nextProfile.subjectType,
    nextProfile.subjectId,
    nextProfile.coreUserId,
    nextProfile.coreClientId,
    nextProfile.chatId,
    nextProfile.username,
    nextProfile.firstName,
    nextProfile.lastName,
    nextProfile.languageCode,
    nextProfile.isPremium,
    nextProfile.botStartedAt,
    nextProfile.miniappStartedAt,
    nextProfile.firstSeenAt,
    nextProfile.lastSeenAt,
    nextProfile.firstStartAt,
    nextProfile.lastStartAt,
    nextProfile.firstOpenAt,
    nextProfile.lastOpenAt,
    nextProfile.launchCount,
    nextProfile.botLaunchCount,
    nextProfile.miniappLaunchCount,
    nextProfile.sessionCount,
    nextProfile.activeDaysCount,
    nextProfile.lastActiveDay,
    nextProfile.lastActivityAt,
    nextProfile.lastActivityKind,
    nextProfile.retentionState,
    nextProfile.lifecycleStage,
    nextProfile.nextReengagementAt,
    nextProfile.reengagementStatus,
    nextProfile.lastReengagementAt,
    JSON.stringify(nextProfile.metadata)
  ];

  let result;

  try {
    result = await executor(existing ? updateSql : insertSql, existing ? updateParams : insertParams);
  } catch (error) {
    if (String(error?.code || "") === "23505") {
      const retryExisting = await resolveExistingTelegramIdentity(companyId, telegramUserId, executor);

      if (!retryExisting?.id) {
        throw error;
      }

      return upsertTelegramIdentity(
        {
          ...payload,
          companyId
        },
        executor
      );
    }

    throw error;
  }

  const lifecycle = await syncTelegramLifecycleFoundation(normalizeProfileRow(result.rows[0]), executor);

  return {
    ok: true,
    profile: lifecycle.profile,
    flags: {
      isFirstSeen,
      isFirstStart,
      isFirstOpen,
      isNewActiveDay,
      retentionState
    },
    subject,
    campaigns: lifecycle.campaigns
  };
}

export async function startMiniAppSession(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();
  const telegramUserId = normalizeText(payload.telegramUserId);
  const subjectType = payload.subjectType || "telegram_user";
  const subjectId = normalizeText(payload.subjectId) || telegramUserId;

  if (!companyId || !telegramUserId || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      skipped: true,
      reason: "miniapp_session_not_available"
    };
  }

  const startedAt = normalizeIsoTimestamp(payload.startedAt);
  const ttlSeconds = Math.max(900, Number(payload.ttlSeconds || 3600));
  const expiresAt = new Date(new Date(startedAt).getTime() + ttlSeconds * 1000).toISOString();
  const sessionToken = crypto.randomUUID();
  const result = await executor(
    `
      insert into miniapp_sessions (
        company_id,
        profile_id,
        subject_type,
        subject_id,
        telegram_user_id,
        telegram_username,
        session_token,
        issued_at,
        expires_at,
        payload,
        started_at,
        device,
        platform,
        telegram_version,
        init_data_hash,
        app_version,
        language_code,
        screen_path,
        chat_id,
        session_status
      )
      values (
        $1, $2, $3, $4, $5, $6, $7,
        $8::timestamptz, $9::timestamptz, $10::jsonb,
        $11::timestamptz, $12, $13, $14, $15, $16, $17, $18, $19, 'ACTIVE'
      )
      returning *
    `,
    [
      companyId,
      payload.profileId || null,
      subjectType,
      subjectId,
      telegramUserId,
      normalizeTelegramUsername(payload.username || payload.telegramUsername),
      sessionToken,
      startedAt,
      expiresAt,
      JSON.stringify(normalizeJson(payload.payload)),
      startedAt,
      normalizeText(payload.device),
      normalizeText(payload.platform),
      normalizeText(payload.telegramVersion),
      normalizeText(payload.initDataHash),
      normalizeText(payload.appVersion),
      normalizeText(payload.languageCode),
      normalizeText(payload.screenPath),
      normalizeText(payload.chatId)
    ]
  );

  return {
    ok: true,
    session: normalizeSessionRow(result.rows[0])
  };
}

export async function endMiniAppSession(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();
  const sessionId = normalizeText(payload.sessionId);
  const sessionToken = normalizeText(payload.sessionToken);

  if (!companyId || (!sessionId && !sessionToken) || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      skipped: true,
      reason: "miniapp_session_end_not_available"
    };
  }

  const endedAt = normalizeIsoTimestamp(payload.endedAt);
  const durationSeconds = payload.durationSeconds == null ? null : Math.max(0, Number(payload.durationSeconds));
  const result = await executor(
    `
      update miniapp_sessions
      set
        ended_at = coalesce(ended_at, $3::timestamptz),
        duration_seconds = coalesce($4::integer, duration_seconds),
        screen_path = coalesce($5, screen_path),
        session_status = 'ENDED',
        payload = payload || $6::jsonb
      where company_id = $1
        and (
          ($2::uuid is not null and id = $2)
          or ($7::text is not null and session_token = $7)
        )
      returning *
    `,
    [
      companyId,
      sessionId || null,
      endedAt,
      Number.isFinite(durationSeconds) ? durationSeconds : null,
      normalizeText(payload.screenPath),
      JSON.stringify(normalizeJson(payload.payload)),
      sessionToken
    ]
  );

  return {
    ok: Boolean(result.rows[0]),
    session: normalizeSessionRow(result.rows[0] || null)
  };
}

export async function trackTelegramAnalyticsEvent(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();
  const eventName = normalizeText(payload.eventName);

  if (!companyId || !eventName || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      skipped: true,
      reason: "telegram_analytics_not_available"
    };
  }

  if (!TELEGRAM_ANALYTICS_EVENTS.includes(eventName)) {
    return {
      ok: false,
      skipped: true,
      reason: "unsupported_event"
    };
  }

  const eventKey = buildEventKey(eventName, payload);

  try {
    await executor(
      `
        insert into telegram_analytics_events (
          company_id,
          profile_id,
          session_id,
          subject_type,
          subject_id,
          user_id,
          client_id,
          lead_id,
          deal_id,
          telegram_user_id,
          chat_id,
          username,
          language_code,
          platform,
          app_version,
          event_name,
          event_at,
          event_key,
          event_payload
        )
        values (
          $1, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7::uuid, $8::uuid, $9::uuid,
          $10, $11, $12, $13, $14, $15, $16, $17::timestamptz, $18, $19::jsonb
        )
      `,
      [
        companyId,
        payload.profileId || null,
        payload.sessionId || null,
        normalizeText(payload.subjectType),
        normalizeText(payload.subjectId),
        payload.userId || null,
        payload.clientId || null,
        payload.leadId || null,
        payload.dealId || null,
        normalizeText(payload.telegramUserId),
        normalizeText(payload.chatId),
        normalizeTelegramUsername(payload.username),
        normalizeText(payload.languageCode),
        normalizeText(payload.platform),
        normalizeText(payload.appVersion),
        eventName,
        normalizeIsoTimestamp(payload.timestamp),
        eventKey,
        JSON.stringify(normalizeJson(payload.eventPayload))
      ]
    );
  } catch (error) {
    if (String(error?.code || "") === "23505") {
      return {
        ok: true,
        skipped: true,
        reason: "duplicate_event"
      };
    }

    throw error;
  }

  return {
    ok: true,
    skipped: false
  };
}

export async function recordMiniAppLaunch(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();

  if (!companyId || !payload.telegramUserId || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      skipped: true,
      reason: "miniapp_launch_not_available"
    };
  }

  let identity;

  try {
    identity = await upsertTelegramIdentity(
      {
        ...payload,
        companyId,
        appOpen: true,
        miniappStarted: true,
        incrementLaunch: true,
        incrementSession: true,
        activityKind: "miniapp_open"
      },
      executor
    );
  } catch (error) {
    throw new Error(`miniapp_identity_failed: ${error.message}`);
  }

  if (!identity.ok || !identity.profile) {
    return identity;
  }

  let sessionResult;

  try {
    sessionResult = await startMiniAppSession(
      {
        ...payload,
        companyId,
        profileId: identity.profile.id,
        subjectType: identity.subject.subjectType,
        subjectId: identity.subject.subjectId,
        initDataHash: payload.initDataHash || hashInitData(payload.initDataRaw),
        languageCode: payload.languageCode || identity.profile.languageCode
      },
      executor
    );
  } catch (error) {
    throw new Error(`miniapp_session_failed: ${error.message}`);
  }

  const session = sessionResult.session || null;
  const commonEventPayload = {
    companyId,
    profileId: identity.profile.id,
    sessionId: session?.id || null,
    subjectType: identity.subject.subjectType,
    subjectId: identity.subject.subjectId,
    userId: identity.subject.coreUserId || null,
    clientId: identity.subject.coreClientId || null,
    telegramUserId: identity.profile.telegramUserId,
    chatId: identity.profile.chatId,
    username: identity.profile.username,
    languageCode: identity.profile.languageCode,
    platform: payload.platform,
    appVersion: payload.appVersion,
    timestamp: payload.timestamp,
    eventPayload: {
      screenPath: payload.screenPath || null,
      device: payload.device || null,
      startParam: payload.startParam || null
    }
  };

  if (identity.flags.isFirstOpen) {
    try {
      await trackTelegramAnalyticsEvent(
        {
          ...commonEventPayload,
          eventName: "first_open"
        },
        executor
      );
    } catch (error) {
      throw new Error(`miniapp_first_open_event_failed: ${error.message}`);
    }
  }

  try {
    await trackTelegramAnalyticsEvent(
      {
        ...commonEventPayload,
        eventName: "app_open"
      },
      executor
    );
  } catch (error) {
    throw new Error(`miniapp_app_open_event_failed: ${error.message}`);
  }

  try {
    await trackTelegramAnalyticsEvent(
      {
        ...commonEventPayload,
        eventName: "session_start"
      },
      executor
    );
  } catch (error) {
    throw new Error(`miniapp_session_start_event_failed: ${error.message}`);
  }

  if (payload.startParam) {
    try {
      await trackTelegramAnalyticsEvent(
        {
          ...commonEventPayload,
          eventName: "invite_used",
          startParam: payload.startParam
        },
        executor
      );
    } catch (error) {
      throw new Error(`miniapp_invite_event_failed: ${error.message}`);
    }

    if (shouldTrackReferral(payload.startParam)) {
      try {
        await trackTelegramAnalyticsEvent(
          {
            ...commonEventPayload,
            eventName: "referral_used",
            startParam: payload.startParam
          },
          executor
        );
      } catch (error) {
        throw new Error(`miniapp_referral_event_failed: ${error.message}`);
      }
    }
  }

  return {
    ok: true,
    profile: identity.profile,
    session,
    flags: identity.flags,
    subject: identity.subject
  };
}

export async function recordTelegramBotTouch(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();

  if (!companyId || !payload.telegramUserId || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      skipped: true,
      reason: "telegram_bot_touch_not_available"
    };
  }

  const identity = await upsertTelegramIdentity(
    {
      ...payload,
      companyId,
      botStarted: Boolean(payload.botStarted),
      activityKind: payload.botStarted ? "bot_start" : "bot_message"
    },
    executor
  );

  if (!identity.ok || !identity.profile) {
    return identity;
  }

  const commonEventPayload = {
    companyId,
    profileId: identity.profile.id,
    subjectType: identity.subject.subjectType,
    subjectId: identity.subject.subjectId,
    userId: identity.subject.coreUserId || null,
    clientId: identity.subject.coreClientId || null,
    telegramUserId: identity.profile.telegramUserId,
    chatId: identity.profile.chatId,
    username: identity.profile.username,
    languageCode: identity.profile.languageCode,
    platform: payload.platform || "telegram-bot",
    appVersion: payload.appVersion,
    timestamp: payload.timestamp,
    eventPayload: {
      command: payload.command || null,
      startParam: payload.startParam || null
    }
  };

  if (identity.flags.isFirstStart) {
    await trackTelegramAnalyticsEvent(
      {
        ...commonEventPayload,
        eventName: "first_start"
      },
      executor
    );
  }

  if (payload.startParam) {
    await trackTelegramAnalyticsEvent(
      {
        ...commonEventPayload,
        eventName: "invite_used",
        startParam: payload.startParam
      },
      executor
    );

    if (shouldTrackReferral(payload.startParam)) {
      await trackTelegramAnalyticsEvent(
        {
          ...commonEventPayload,
          eventName: "referral_used",
          startParam: payload.startParam
        },
        executor
      );
    }
  }

  return {
    ok: true,
    profile: identity.profile,
    flags: identity.flags
  };
}

export async function recordRegistrationCompleted(payload = {}, executor = query) {
  const identity = await upsertTelegramIdentity(
    {
      ...payload,
      activityKind: "registration_completed"
    },
    executor
  );

  if (!identity.ok || !identity.profile) {
    return identity;
  }

  await trackTelegramAnalyticsEvent(
    {
      companyId: payload.companyId || getCompanyId(),
      profileId: identity.profile.id,
      subjectType: identity.subject.subjectType,
      subjectId: identity.subject.subjectId,
      userId: identity.subject.coreUserId || null,
      clientId: identity.subject.coreClientId || null,
      telegramUserId: identity.profile.telegramUserId,
      chatId: identity.profile.chatId,
      username: identity.profile.username,
      languageCode: identity.profile.languageCode,
      platform: payload.platform || "telegram-bot",
      appVersion: payload.appVersion,
      timestamp: payload.timestamp,
      eventName: "registration_completed",
      eventPayload: {
        role: payload.role || null,
        name: payload.firstName || payload.displayName || null
      }
    },
    executor
  );

  return {
    ok: true,
    profile: identity.profile
  };
}

export async function recordLeadLifecycleAnalytics(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();

  if (!companyId || !payload.telegramUserId || !isLiveDatabaseEnabled()) {
    return {
      ok: false,
      skipped: true,
      reason: "lead_lifecycle_analytics_not_available"
    };
  }

  const identity = await upsertTelegramIdentity(
    {
      ...payload,
      companyId,
      activityKind: "lead_created"
    },
    executor
  );

  if (!identity.ok || !identity.profile) {
    return identity;
  }

  const commonEventPayload = {
    companyId,
    profileId: identity.profile.id,
    subjectType: identity.subject.subjectType,
    subjectId: identity.subject.subjectId,
    userId: identity.subject.coreUserId || null,
    clientId: payload.clientId || identity.subject.coreClientId || null,
    leadId: payload.leadId || null,
    dealId: payload.dealId || null,
    telegramUserId: identity.profile.telegramUserId,
    chatId: identity.profile.chatId,
    username: identity.profile.username,
    languageCode: identity.profile.languageCode,
    platform: payload.platform || "telegram-bot",
    appVersion: payload.appVersion,
    timestamp: payload.timestamp,
    eventPayload: {
      source: payload.source || "telegram",
      product: payload.product || null
    }
  };

  await trackTelegramAnalyticsEvent(
    {
      ...commonEventPayload,
      eventName: "lead_created",
      eventKey: payload.leadId ? `lead_created:${payload.leadId}` : null
    },
    executor
  );

  if (payload.clientId) {
    await trackTelegramAnalyticsEvent(
      {
        ...commonEventPayload,
        clientId: payload.clientId,
        eventName: "client_created",
        eventKey: `client_created:${payload.clientId}`
      },
      executor
    );
  }

  if (payload.dealId) {
    await trackTelegramAnalyticsEvent(
      {
        ...commonEventPayload,
        dealId: payload.dealId,
        eventName: "deal_created",
        eventKey: `deal_created:${payload.dealId}`
      },
      executor
    );
  }

  return {
    ok: true,
    profile: identity.profile
  };
}

export async function getTelegramLaunchMetrics(companyId = getCompanyId(), executor = query) {
  if (!companyId || !isLiveDatabaseEnabled()) {
    return {
      enabled: false,
      usersTotal: 0,
      activeUsers: 0,
      dailyUsers: 0,
      weeklyUsers: 0,
      monthlyUsers: 0,
      newUsers: 0,
      sessionsTotal: 0,
      sessionsToday: 0,
      analyticsEventsTotal: 0
    };
  }

  const [usersResult, sessionsResult, eventsResult] = await Promise.all([
    executor(
      `
        select
          count(*)::int as users_total,
          count(*) filter (where last_seen_at >= now() - interval '14 days')::int as active_users,
          count(*) filter (where last_seen_at >= now() - interval '1 day')::int as daily_users,
          count(*) filter (where last_seen_at >= now() - interval '7 days')::int as weekly_users,
          count(*) filter (where last_seen_at >= now() - interval '30 days')::int as monthly_users,
          count(*) filter (where first_seen_at >= now() - interval '1 day')::int as new_users
        from telegram_identities
        where company_id = $1
      `,
      [companyId]
    ),
    executor(
      `
        select
          count(*)::int as sessions_total,
          count(*) filter (where started_at >= now() - interval '1 day')::int as sessions_today
        from miniapp_sessions
        where company_id = $1
      `,
      [companyId]
    ),
    executor(
      `
        select count(*)::int as analytics_events_total
        from telegram_analytics_events
        where company_id = $1
      `,
      [companyId]
    )
  ]);

  const users = usersResult.rows[0] || {};
  const sessions = sessionsResult.rows[0] || {};
  const events = eventsResult.rows[0] || {};

  return {
    enabled: true,
    usersTotal: Number(users.users_total || 0),
    activeUsers: Number(users.active_users || 0),
    dailyUsers: Number(users.daily_users || 0),
    weeklyUsers: Number(users.weekly_users || 0),
    monthlyUsers: Number(users.monthly_users || 0),
    newUsers: Number(users.new_users || 0),
    sessionsTotal: Number(sessions.sessions_total || 0),
    sessionsToday: Number(sessions.sessions_today || 0),
    analyticsEventsTotal: Number(events.analytics_events_total || 0)
  };
}

export async function getTelegramRetentionMetrics(companyId = getCompanyId(), executor = query) {
  if (!companyId || !isLiveDatabaseEnabled()) {
    return {
      enabled: false,
      lifecycle: {
        newUsers: 0,
        activatedUsers: 0,
        engagedUsers: 0,
        dormantUsers: 0,
        inactiveUsers: 0
      },
      campaigns: {
        total: 0,
        scheduled: 0,
        ready: 0,
        byType: {}
      }
    };
  }

  const [lifecycleResult, campaignResult] = await Promise.all([
    executor(
      `
        select
          count(*) filter (
            where coalesce(bot_launch_count, 0) + coalesce(miniapp_launch_count, 0) <= 1
              and last_seen_at >= now() - interval '1 day'
          )::int as new_users,
          count(*) filter (
            where coalesce(bot_launch_count, 0) + coalesce(miniapp_launch_count, 0) >= 2
              and active_days_count < 3
              and last_seen_at >= now() - interval '7 days'
          )::int as activated_users,
          count(*) filter (
            where active_days_count >= 3
              and last_seen_at >= now() - interval '7 days'
          )::int as engaged_users,
          count(*) filter (
            where last_seen_at < now() - interval '7 days'
              and last_seen_at >= now() - interval '30 days'
          )::int as dormant_users,
          count(*) filter (
            where last_seen_at < now() - interval '30 days'
          )::int as inactive_users
        from telegram_identities
        where company_id = $1
      `,
      [companyId]
    ),
    executor(
      `
        select
          count(*)::int as total,
          count(*) filter (where status = 'scheduled' and scheduled_at > now())::int as scheduled,
          count(*) filter (where status = 'scheduled' and scheduled_at <= now())::int as ready
        from telegram_retention_campaigns
        where company_id = $1
      `,
      [companyId]
    )
  ]);

  const byTypeResult = await executor(
    `
      select campaign_type, count(*)::int as total
      from telegram_retention_campaigns
      where company_id = $1
      group by campaign_type
    `,
    [companyId]
  );

  return {
    enabled: true,
    lifecycle: {
      newUsers: Number(lifecycleResult.rows[0]?.new_users || 0),
      activatedUsers: Number(lifecycleResult.rows[0]?.activated_users || 0),
      engagedUsers: Number(lifecycleResult.rows[0]?.engaged_users || 0),
      dormantUsers: Number(lifecycleResult.rows[0]?.dormant_users || 0),
      inactiveUsers: Number(lifecycleResult.rows[0]?.inactive_users || 0)
    },
    campaigns: {
      total: Number(campaignResult.rows[0]?.total || 0),
      scheduled: Number(campaignResult.rows[0]?.scheduled || 0),
      ready: Number(campaignResult.rows[0]?.ready || 0),
      byType: Object.fromEntries(
        byTypeResult.rows.map((row) => [row.campaign_type, Number(row.total || 0)])
      )
    }
  };
}
