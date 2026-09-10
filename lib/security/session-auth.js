const AUTH_COOKIE_NAME = "bose-session";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const STAFF_ROLES = Object.freeze([
  "owner",
  "manager",
  "operator",
  "designer",
  "production",
  "installer"
]);

function getSigningSecret() {
  return String(
    process.env.BOSE_AUTH_SECRET ||
      process.env.TELEGRAM_BOT_SECRET_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ""
  ).trim();
}

function encodeBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return new Uint8Array(signature);
}

export function isStaffRole(role) {
  return STAFF_ROLES.includes(String(role || "").trim().toLowerCase());
}

export function getBoseSessionCookieName() {
  return AUTH_COOKIE_NAME;
}

export async function createBoseSessionToken(claims = {}) {
  const secret = getSigningSecret();
  if (!secret) return null;

  const expiresAt = Number(claims.expiresAt || 0);
  const payload = {
    v: 1,
    sid: String(claims.sessionId || ""),
    companyId: claims.companyId || null,
    subjectType: claims.subjectType || "telegram_user",
    subjectId: claims.subjectId || null,
    role: String(claims.role || "client").toLowerCase(),
    owner: claims.isOwner === true,
    exp: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 60 * 60 * 1000
  };

  if (!payload.sid || !payload.subjectId || payload.exp <= Date.now()) return null;

  const encoded = encodeBytes(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${encodeBytes(await sign(encoded, secret))}`;
}

export async function verifyBoseSessionToken(value) {
  const secret = getSigningSecret();
  const [encoded, providedSignature, ...extra] = String(value || "").split(".");
  if (!secret || !encoded || !providedSignature || extra.length) return null;

  try {
    const expectedSignature = await sign(encoded, secret);
    if (!equalBytes(decodeBytes(providedSignature), expectedSignature)) return null;
    const payload = JSON.parse(decoder.decode(decodeBytes(encoded)));

    if (
      payload?.v !== 1 ||
      !payload?.sid ||
      !payload?.subjectId ||
      !Number.isFinite(Number(payload?.exp)) ||
      Number(payload.exp) <= Date.now()
    ) {
      return null;
    }

    return {
      sessionId: payload.sid,
      companyId: payload.companyId || null,
      subjectType: payload.subjectType || "telegram_user",
      subjectId: payload.subjectId,
      role: String(payload.role || "client").toLowerCase(),
      isOwner: payload.owner === true,
      expiresAt: new Date(Number(payload.exp)).toISOString()
    };
  } catch {
    return null;
  }
}

export async function getBoseSessionFromRequest(request) {
  return verifyBoseSessionToken(request?.cookies?.get?.(AUTH_COOKIE_NAME)?.value);
}

export async function getBoseSessionFromCookieStore(cookieStore) {
  return verifyBoseSessionToken(cookieStore?.get?.(AUTH_COOKIE_NAME)?.value);
}

export function buildBoseSessionCookie(value, expiresAt) {
  const expiration = new Date(expiresAt || Date.now() + 60 * 60 * 1000);
  const maxAge = Math.max(0, Math.floor((expiration.getTime() - Date.now()) / 1000));

  return {
    name: AUTH_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    expires: expiration
  };
}
