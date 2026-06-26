import { normalizeCoreRole } from "./core/roles";

export const OWNER_ACCESS_COOKIE = "bose-owner";

const FALLBACK_OWNER_USERNAMES = Object.freeze(["arslanovmurat116", "murat_rdn"]);

function normalizeText(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function normalizeUsername(value) {
  const trimmed = normalizeText(value);
  return trimmed ? trimmed.replace(/^@+/, "").toLowerCase() : null;
}

function parseAllowlist(value) {
  return new Set(
    String(value || "")
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function getOwnerUsernameAllowlist() {
  const configured = [...parseAllowlist(process.env.BOSE_OWNER_USERNAMES)].map(normalizeUsername).filter(Boolean);
  return new Set([...FALLBACK_OWNER_USERNAMES, ...configured]);
}

function getOwnerTelegramIdAllowlist() {
  return parseAllowlist(process.env.BOSE_OWNER_TELEGRAM_IDS);
}

export function isLocalHostname(value) {
  const host = String(value || "").toLowerCase();
  return host.includes("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

export function isOwnerIdentity(candidate = {}) {
  const normalizedCoreRole = normalizeCoreRole(
    candidate.coreRole || candidate.role || candidate.subjectRole || null,
    "manager"
  );

  if (normalizedCoreRole === "owner") {
    return true;
  }

  const username = normalizeUsername(candidate.username || candidate.telegramUsername);

  if (username && getOwnerUsernameAllowlist().has(username)) {
    return true;
  }

  const telegramUserId = normalizeText(candidate.telegramUserId || candidate.subjectId);

  return Boolean(telegramUserId && getOwnerTelegramIdAllowlist().has(telegramUserId));
}

export function buildOwnerCookieValue(enabled) {
  return `${OWNER_ACCESS_COOKIE}=${enabled ? "1" : "0"}; path=/; max-age=${enabled ? 60 * 60 * 24 * 30 : 0}; samesite=lax`;
}
