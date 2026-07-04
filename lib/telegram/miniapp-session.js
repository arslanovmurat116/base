import { isLiveDatabaseEnabled, query } from "../db";

function getCompanyId() {
  return process.env.DISET_DEFAULT_COMPANY_ID || null;
}

function normalizeText(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function normalizeSessionRow(row) {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.company_id || null,
    profileId: row.profile_id || null,
    subjectType: row.subject_type || "telegram_user",
    subjectId: row.subject_id || null,
    telegramUserId: row.telegram_user_id || null,
    telegramUsername: row.telegram_username || null,
    chatId: row.chat_id || null,
    platform: row.platform || null,
    appVersion: row.app_version || null,
    languageCode: row.language_code || null,
    status: row.session_status || "ACTIVE",
    expiresAt: row.expires_at || null,
    startedAt: row.started_at || row.issued_at || null
  };
}

export async function getActiveMiniAppSessionSnapshot(payload = {}, executor = query) {
  const companyId = payload.companyId || getCompanyId();
  const sessionId = normalizeText(payload.sessionId);
  const sessionToken = normalizeText(payload.sessionToken);

  if (!companyId || !sessionId || !sessionToken || !isLiveDatabaseEnabled()) {
    return null;
  }

  const result = await executor(
    `
      select
        id,
        company_id,
        profile_id,
        subject_type,
        subject_id,
        telegram_user_id,
        telegram_username,
        chat_id,
        platform,
        app_version,
        language_code,
        session_status,
        expires_at,
        started_at,
        issued_at
      from miniapp_sessions
      where company_id = $1
        and id = $2::uuid
        and session_token = $3
        and session_status = 'ACTIVE'
        and expires_at > now()
      limit 1
    `,
    [companyId, sessionId, sessionToken]
  );

  return normalizeSessionRow(result.rows[0]);
}
