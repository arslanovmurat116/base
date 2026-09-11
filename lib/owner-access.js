import { normalizeCoreRole } from "./core/roles";

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

export function isOwnerIdentity(candidate = {}) {
  const normalizedCoreRole = normalizeCoreRole(
    candidate.coreRole || candidate.role || candidate.subjectRole || null,
    "manager"
  );

  if (normalizedCoreRole === "owner") {
    return true;
  }

  const telegramUserId = normalizeText(candidate.telegramUserId || candidate.subjectId);

  return Boolean(telegramUserId && getOwnerTelegramIdAllowlist().has(telegramUserId));
}
