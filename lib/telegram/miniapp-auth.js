import crypto from "node:crypto";
import { isLiveDatabaseEnabled, query } from "../db";
import { mapTelegramRoleToCoreRole } from "../core/roles";
import { projectAccess } from "./project-service";

function parseInitData(initDataRaw) {
  const searchParams = new URLSearchParams(String(initDataRaw || ""));
  const entries = {};

  for (const [key, value] of searchParams.entries()) {
    entries[key] = value;
  }

  return entries;
}

function buildDataCheckString(entries) {
  return Object.entries(entries)
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function safeJsonParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getMiniAppAuthPlan() {
  return {
    stage: "verified-session",
    verificationMethod: "telegram_init_data_hmac",
    sessionStrategy: "verified initData mapped to a signed HttpOnly BOSE session",
    nextSteps: [
      "Use the issued server session for workspace access",
      "Assign trusted Telegram IDs to project access lists",
      "Rotate BOSE_AUTH_SECRET only through a controlled deployment"
    ]
  };
}

export function verifyTelegramMiniAppInitData(
  initDataRaw,
  { botToken, maxAgeSeconds = 3600 } = {}
) {
  if (!initDataRaw) {
    return {
      ok: false,
      verified: false,
      code: "missing_init_data",
      message: "Telegram initData is required"
    };
  }

  if (!botToken) {
    return {
      ok: false,
      verified: false,
      code: "missing_bot_token",
      message: "Telegram bot token is required for Mini App verification"
    };
  }

  const entries = parseInitData(initDataRaw);
  const providedHash = entries.hash;

  if (!providedHash) {
    return {
      ok: false,
      verified: false,
      code: "missing_hash",
      message: "Telegram initData hash is missing"
    };
  }

  const dataCheckString = buildDataCheckString(entries);
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const providedHashBuffer = Buffer.from(providedHash, "hex");
  const expectedHashBuffer = Buffer.from(expectedHash, "hex");

  if (
    providedHashBuffer.length !== expectedHashBuffer.length ||
    !crypto.timingSafeEqual(providedHashBuffer, expectedHashBuffer)
  ) {
    return {
      ok: false,
      verified: false,
      code: "invalid_hash",
      message: "Telegram initData signature mismatch"
    };
  }

  const authDate = Number(entries.auth_date || 0);
  const ageSeconds = authDate ? Math.max(0, Math.floor(Date.now() / 1000) - authDate) : null;

  if (ageSeconds !== null && ageSeconds > maxAgeSeconds) {
    return {
      ok: false,
      verified: false,
      code: "expired",
      message: "Telegram initData is too old",
      ageSeconds
    };
  }

  return {
    ok: true,
    verified: true,
    code: "verified",
    ageSeconds,
    authDate,
    queryId: entries.query_id || null,
    chatType: entries.chat_type || null,
    chatInstance: entries.chat_instance || null,
    startParam: entries.start_param || null,
    canSendAfter: entries.can_send_after ? Number(entries.can_send_after) : null,
    user: safeJsonParse(entries.user),
    receiver: safeJsonParse(entries.receiver),
    raw: entries
  };
}

export function buildMiniAppSessionCandidate(verification) {
  if (!verification?.verified || !verification.user) {
    return null;
  }

  const user = verification.user;
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  return {
    authSource: "telegram-miniapp",
    telegramUserId: user.id ? String(user.id) : null,
    telegramUsername: user.username ? `@${String(user.username).replace(/^@+/, "")}` : null,
    displayName: displayName || user.username || "Telegram user",
    firstName: user.first_name || null,
    lastName: user.last_name || null,
    languageCode: user.language_code || null,
    isPremium: Boolean(user.is_premium),
    allowsWriteToPm: Boolean(user.allows_write_to_pm),
    startParam: verification.startParam || null
  };
}

function getDefaultCompanyId() {
  return process.env.DISET_DEFAULT_COMPANY_ID || null;
}

export async function resolveMiniAppSubject(candidate) {
  const companyId = getDefaultCompanyId();

  if (!candidate?.telegramUserId) {
    return {
      subjectType: "telegram_user",
      subjectId: candidate?.telegramUserId || "unknown",
      companyId
    };
  }

  if (!isLiveDatabaseEnabled() || !companyId) {
    return {
      subjectType: "telegram_user",
      subjectId: candidate.telegramUserId,
      companyId
    };
  }

  const normalizedUsername = candidate.telegramUsername
    ? String(candidate.telegramUsername).replace(/^@+/, "").toLowerCase()
    : null;
  const subscriberResult = await query(
    `
      select role
      from telegram_subscribers
      where company_id = $1
        and telegram_user_id = $2::text
      order by last_seen_at desc
      limit 1
    `,
    [companyId, candidate.telegramUserId]
  );

  if (subscriberResult.rows[0]?.role && projectAccess(candidate.telegramUserId).read) {
    return {
      subjectType: "telegram_staff",
      subjectId: candidate.telegramUserId,
      role: mapTelegramRoleToCoreRole(subscriberResult.rows[0].role, "operator"),
      companyId
    };
  }

  const userResult = await query(
    `
      select id, role
      from users
      where company_id = $1
        and (
          $2::text is not null
          and lower(coalesce(telegram_username, '')) = $2::text
        )
      limit 1
    `,
    [companyId, normalizedUsername]
  );

  if (userResult.rows[0]?.id) {
    return {
      subjectType: "user",
      subjectId: userResult.rows[0].id,
      role: userResult.rows[0].role || null,
      companyId
    };
  }

  const clientResult = await query(
    `
      select id
      from clients
      where company_id = $1
        and (
          telegram_user_id = $2::text
          or ($3::text is not null and lower(coalesce(telegram_username, '')) = $3::text)
        )
      limit 1
    `,
    [companyId, candidate.telegramUserId, normalizedUsername]
  );

  if (clientResult.rows[0]?.id) {
    return {
      subjectType: "client",
      subjectId: clientResult.rows[0].id,
      companyId
    };
  }

  return {
    subjectType: "telegram_user",
    subjectId: candidate.telegramUserId,
    companyId
  };
}

export async function issueMiniAppSession(candidate, options = {}) {
  const subject = await resolveMiniAppSubject(candidate);
  const ttlSeconds = Math.max(300, Number(options.ttlSeconds || 3600));
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
  const sessionToken = crypto.randomUUID();

  if (isLiveDatabaseEnabled() && subject.companyId) {
    await query(
      `
        insert into miniapp_sessions (
          company_id,
          subject_type,
          subject_id,
          telegram_user_id,
          telegram_username,
          session_token,
          issued_at,
          expires_at,
          payload
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        subject.companyId,
        subject.subjectType,
        subject.subjectId,
        candidate.telegramUserId,
        candidate.telegramUsername,
        sessionToken,
        issuedAt.toISOString(),
        expiresAt.toISOString(),
        JSON.stringify({
          startParam: candidate.startParam || null,
          displayName: candidate.displayName || null,
          languageCode: candidate.languageCode || null,
          role: subject.role || null
        })
      ]
    );
  }

  return {
    sessionToken,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    subject
  };
}
