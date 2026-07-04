import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSystemHealthHttpStatus } from "../lib/system-health-core.mjs";

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
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--")) {
      positionals.push(argument);
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

  if (!options.has("--base-url") && positionals.length > 0) {
    options.set("--base-url", positionals[0]);
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

function sanitizeUrlForLogs(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return String(value || "").replace(/\/\/[^@/]+@/, "//");
  }
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

async function fetchHealth(url, timeoutMs) {
  const response = await fetchResponse(url, timeoutMs);
  const bodyText = await response.text();

  let payload = null;

  if (bodyText.trim()) {
    try {
      payload = JSON.parse(bodyText);
    } catch (error) {
      throw new Error(`Malformed JSON from ${sanitizeUrlForLogs(url)}: ${error.message}`);
    }
  }

  return {
    httpStatus: response.status,
    payload
  };
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

function printNextRunHint(baseUrl) {
  console.error("Run the BOSE runtime first:");
  console.error(`  cd "${repoRoot}"`);
  console.error("  npm run start -- --hostname 127.0.0.1 --port 3000");
  console.error(`  npm run check:rc:runtime -- --base-url ${baseUrl}`);
}

function validateHealthPayload(payload) {
  const issues = [];

  if (!payload || typeof payload !== "object") {
    issues.push("Health response is not a JSON object.");
    return issues;
  }

  if (typeof payload.ok !== "boolean") {
    issues.push("Field ok must be a boolean.");
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

function printHealthWarnings(health) {
  for (const warning of health.warnings) {
    console.log(`WARNING ${warning}`);
  }
}

function failHealth(httpStatus, health, healthUrl) {
  const expectedHttpStatus = getSystemHealthHttpStatus(health);

  console.error(
    `SYSTEM_ERR Health is not ready at ${sanitizeUrlForLogs(healthUrl)} (http=${httpStatus}, expected=${expectedHttpStatus}, status=${health.status}, mode=${health.mode}, ok=${health.ok}, ready=${health.ready}).`
  );
  printHealthWarnings(health);
  process.exitCode = 1;
}

async function checkRoute(baseUrl, route, timeoutMs) {
  const url = `${baseUrl}${route.path}`;
  const response = await fetchResponse(url, timeoutMs);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${sanitizeUrlForLogs(url)}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const requireReady = options.has("--require-ready");
  const timeoutMs = parseTimeout(options.get("--timeout-ms"), 4000);
  const baseUrl = normalizeBaseUrl(options.get("--base-url") || process.env.APP_BASE_URL);
  const healthUrl = `${baseUrl}/api/system/health`;

  let healthResponse;

  try {
    healthResponse = await fetchHealth(healthUrl, timeoutMs);
  } catch (error) {
    if (isRuntimeUnavailable(error)) {
      console.error(`SYSTEM_ERR Runtime is unavailable at ${sanitizeUrlForLogs(baseUrl)}.`);
      console.error(`Reason: ${error.message}`);
      printNextRunHint(sanitizeUrlForLogs(baseUrl));
      process.exitCode = 1;
      return;
    }

    console.error(`SYSTEM_ERR ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const health = healthResponse.payload;
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
    `HEALTH http=${healthResponse.httpStatus} status=${health.status} mode=${health.mode} ok=${health.ok} ready=${health.ready} endpoint=${sanitizeUrlForLogs(healthUrl)}`
  );

  const expectedHttpStatus = getSystemHealthHttpStatus(health);
  const runtimeReady =
    healthResponse.httpStatus === 200 &&
    expectedHttpStatus === 200 &&
    health.ready === true &&
    health.mode === "live" &&
    health.status === "ok";

  if (healthResponse.httpStatus !== expectedHttpStatus) {
    console.error(
      `SYSTEM_ERR Health endpoint returned unexpected HTTP status ${healthResponse.httpStatus}; expected ${expectedHttpStatus} for mode=${health.mode}.`
    );
    printHealthWarnings(health);
    process.exitCode = 1;
    return;
  }

  if (healthResponse.httpStatus !== 200) {
    failHealth(healthResponse.httpStatus, health, healthUrl);
    return;
  }

  if (requireReady && !runtimeReady) {
    failHealth(healthResponse.httpStatus, health, healthUrl);
    return;
  }

  if (!runtimeReady) {
    failHealth(healthResponse.httpStatus, health, healthUrl);
    return;
  }

  if (health.warnings.length > 0) {
    printHealthWarnings(health);
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
