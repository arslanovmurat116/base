import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const REQUIRED_ROUTES = [
  { path: "/" },
  { path: "/dashboard" },
  { path: "/clients" },
  { path: "/api/auth/session" }
];

function parseArgs(argv) {
  const options = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--")) {
      continue;
    }

    const [flag, inlineValue] = argument.split("=", 2);
    if (inlineValue !== undefined) {
      options.set(flag, inlineValue);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options.set(flag, next);
      index += 1;
      continue;
    }

    options.set(flag, true);
  }

  return options;
}

function parseTimeout(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBaseUrl(value) {
  const fallback = "http://127.0.0.1:3000";
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim().replace(/\/+$/, "");
}

function createRequestOptions(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    release() {
      clearTimeout(timer);
    }
  };
}

async function fetchResponse(url, timeoutMs) {
  const request = createRequestOptions(timeoutMs);

  try {
    return await fetch(url, { signal: request.signal });
  } finally {
    request.release();
  }
}

async function fetchJson(url, timeoutMs) {
  const response = await fetchResponse(url, timeoutMs);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`Malformed JSON from ${url}: ${error.message}`);
  }
}

function isRuntimeUnavailable(error) {
  if (!error) {
    return false;
  }

  const message = typeof error.message === "string" ? error.message : "";
  return (
    error.name === "AbortError" ||
    /fetch failed/i.test(message) ||
    /ECONNREFUSED/i.test(message) ||
    /ENOTFOUND/i.test(message) ||
    /ETIMEDOUT/i.test(message)
  );
}

function printNextRunHint() {
  console.error("Run the BOSE app first:");
  console.error(`  cd "${repoRoot}"`);
  console.error("  npm run dev");
}

function validateHealthPayload(payload) {
  const issues = [];

  if (!payload || typeof payload !== "object") {
    issues.push("Health response is not a JSON object.");
    return issues;
  }

  if (typeof payload.ready !== "boolean") {
    issues.push("Field ready must be a boolean.");
  }

  if (!["live", "mock", "degraded", "misconfigured"].includes(payload.mode)) {
    issues.push("Field mode must be one of live, mock, degraded, misconfigured.");
  }

  if (!["ok", "warn", "error"].includes(payload.status)) {
    issues.push("Field status must be one of ok, warn, error.");
  }

  if (!payload.database || typeof payload.database !== "object") {
    issues.push("Field database must be an object.");
  }

  if (!payload.telegram || typeof payload.telegram !== "object") {
    issues.push("Field telegram must be an object.");
  }

  if (!Array.isArray(payload.warnings)) {
    issues.push("Field warnings must be an array.");
  }

  if (typeof payload.timestamp !== "string" || !payload.timestamp.trim()) {
    issues.push("Field timestamp must be a non-empty string.");
  }

  return issues;
}

async function checkRoute(baseUrl, route, timeoutMs) {
  const url = `${baseUrl}${route.path}`;
  const response = await fetchResponse(url, timeoutMs);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const requireReady = options.has("--require-ready");
  const timeoutMs = parseTimeout(options.get("--timeout-ms"), 4000);
  const baseUrl = normalizeBaseUrl(options.get("--base-url") || process.env.APP_BASE_URL);
  const healthUrl = `${baseUrl}/api/system/health`;

  let health;

  try {
    health = await fetchJson(healthUrl, timeoutMs);
  } catch (error) {
    if (isRuntimeUnavailable(error)) {
      console.error(`SYSTEM_ERR Runtime is unavailable at ${baseUrl}.`);
      console.error(`Reason: ${error.message}`);
      printNextRunHint();
      process.exitCode = 1;
      return;
    }

    console.error(`SYSTEM_ERR ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const validationIssues = validateHealthPayload(health);
  if (validationIssues.length > 0) {
    console.error("SYSTEM_ERR Health response failed validation:");
    for (const issue of validationIssues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `HEALTH status=${health.status} mode=${health.mode} ready=${health.ready} endpoint=${healthUrl}`
  );

  if (health.warnings.length > 0) {
    for (const warning of health.warnings) {
      console.log(`WARNING ${warning}`);
    }
  }

  if (requireReady) {
    const readyForRelease =
      health.ready === true && health.mode === "live" && health.status === "ok";

    if (!readyForRelease) {
      console.error(
        `SYSTEM_ERR Release gate failed because health is not ready (status=${health.status}, mode=${health.mode}, ready=${health.ready}).`
      );
      printNextRunHint();
      process.exitCode = 1;
      return;
    }
  }

  try {
    for (const route of REQUIRED_ROUTES) {
      await checkRoute(baseUrl, route, timeoutMs);
      console.log(`OK ${route.path}`);
    }
  } catch (error) {
    console.error(`SYSTEM_ERR ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(requireReady ? "SYSTEM_READY_OK" : "SYSTEM_CHECK_OK");
}

main().catch((error) => {
  console.error(`SYSTEM_ERR ${error.message}`);
  process.exitCode = 1;
});
