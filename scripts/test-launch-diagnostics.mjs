import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getEnvironmentPublicSummary } from "../lib/env.js";
import {
  createInternalSystemHealth,
  evaluateSystemHealth,
  getSystemHealthHttpStatus
} from "../lib/system-health-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const startDevScript = path.join(repoRoot, "start-dev.ps1");
const checkLaunchConfigScript = path.join(repoRoot, "scripts", "check-launch-config.mjs");
const checkSystemScript = path.join(repoRoot, "scripts", "check-system.mjs");

const RUNTIME_ENV_KEYS = [
  "DISET_DEFAULT_COMPANY_ID",
  "APP_BASE_URL",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DATABASE",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_SSL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_SECRET_TOKEN",
  "CRON_SECRET"
];

function createTempProject(prefix, envLocalContent = null) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(projectDir, ".env.example"), "# template\n", "utf8");

  if (envLocalContent !== null) {
    fs.writeFileSync(path.join(projectDir, ".env.local"), envLocalContent, "utf8");
  }

  return projectDir;
}

function buildChildEnv(overrides = {}) {
  const env = { ...process.env };

  for (const key of RUNTIME_ENV_KEYS) {
    delete env[key];
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value == null) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  return env;
}

function runNode(argumentsList, options = {}) {
  return spawnSync(process.execPath, argumentsList, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options
  });
}

function runNodeAsync(argumentsList, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argumentsList, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function runPowerShell(argumentsList, options = {}) {
  return spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", ...argumentsList],
    {
      cwd: repoRoot,
      encoding: "utf8",
      ...options
    }
  );
}

function collectOutput(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

async function withEnv(overrides, callback) {
  const previousValues = new Map();

  for (const key of RUNTIME_ENV_KEYS) {
    previousValues.set(key, process.env[key]);
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const value = overrides[key];
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    } else {
      delete process.env[key];
    }
  }

  try {
    return await callback();
  } finally {
    for (const key of RUNTIME_ENV_KEYS) {
      const previous = previousValues.get(key);
      if (previous == null) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  }
}

function createLiveEnv(overrides = {}) {
  return {
    DISET_DEFAULT_COMPANY_ID: "company_demo",
    APP_BASE_URL: "https://bose.example.com",
    POSTGRES_HOST: "localhost",
    POSTGRES_DATABASE: "bose",
    POSTGRES_USER: "user",
    POSTGRES_PASSWORD: "secret",
    TELEGRAM_BOT_TOKEN: "telegram-secret-token",
    ...overrides
  };
}

async function createRealHealth(envOverrides, databaseStatus) {
  return withEnv(envOverrides, async () => {
    const env = getEnvironmentPublicSummary();
    const appBaseUrl = String(process.env.APP_BASE_URL || "").trim();

    return evaluateSystemHealth({
      env,
      database: databaseStatus,
      telegram: {
        configured: Boolean(String(process.env.TELEGRAM_BOT_TOKEN || "").trim()),
        appUrlReady: /^https:\/\//i.test(appBaseUrl),
        analyticsEnabled: Boolean(
          String(process.env.DISET_DEFAULT_COMPANY_ID || "").trim() && env.database.liveReady
        )
      }
    });
  });
}

async function withHealthServer(statusCode, body, callback) {
  const server = http.createServer((request, response) => {
    if (request.url === "/api/system/health") {
      response.writeHead(statusCode, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
      return;
    }

    if (
      request.url === "/" ||
      request.url === "/dashboard" ||
      request.url === "/clients"
    ) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<html><body>ok</body></html>");
      return;
    }

    if (request.url === "/api/auth/session") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function testStartDevMissingLocalEnv() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "BOSE-start-dev-"));
  fs.copyFileSync(startDevScript, path.join(tempDir, "start-dev.ps1"));
  fs.writeFileSync(path.join(tempDir, ".env.example"), "APP_BASE_URL=https://example.com\n");

  const result = runPowerShell(["-File", path.join(tempDir, "start-dev.ps1")], {
    cwd: tempDir
  });
  const output = collectOutput(result);

  assert.notEqual(result.status, 0);
  assert.match(output, /Missing local environment file:/);
  assert.match(output, /Copy-Item -LiteralPath/);
  assert.equal(fs.existsSync(path.join(tempDir, ".env.local")), false);
}

async function testLiveDbWithoutPort() {
  const health = await createRealHealth(createLiveEnv({ POSTGRES_PORT: null }), {
    ok: true,
    mode: "live",
    message: "Database connection is healthy",
    timestamp: new Date().toISOString()
  });

  assert.equal(health.mode, "live");
  assert.equal(health.ready, true);
}

async function testLiveDbWithoutSsl() {
  const health = await createRealHealth(createLiveEnv({ POSTGRES_SSL: null }), {
    ok: true,
    mode: "live",
    message: "Database connection is healthy",
    timestamp: new Date().toISOString()
  });

  assert.equal(health.mode, "live");
  assert.equal(health.ready, true);
}

async function testMockFallbackClassification() {
  const health = await createRealHealth(
    {
      DISET_DEFAULT_COMPANY_ID: "company_demo",
      APP_BASE_URL: "https://bose.example.com",
      TELEGRAM_BOT_TOKEN: "telegram-secret-token"
    },
    {
      ok: false,
      mode: "mock",
      message: "Missing environment variables for the live database"
    }
  );

  assert.equal(health.mode, "mock");
  assert.equal(health.ok, true);
  assert.equal(health.ready, false);
}

async function testPartialDbConfigIsMisconfigured() {
  const health = await createRealHealth(
    {
      DISET_DEFAULT_COMPANY_ID: "company_demo",
      APP_BASE_URL: "https://bose.example.com",
      POSTGRES_HOST: "localhost",
      TELEGRAM_BOT_TOKEN: "telegram-secret-token"
    },
    {
      ok: false,
      mode: "mock",
      message: "Missing environment variables for the live database"
    }
  );

  assert.equal(health.mode, "misconfigured");
  assert.equal(health.ok, false);
  assert.equal(health.ready, false);
}

async function testDatabaseRuntimeFailureIsDegraded() {
  const health = await createRealHealth(createLiveEnv(), {
    ok: false,
    mode: "degraded",
    message: "Database health check failed: connect timeout"
  });

  assert.equal(health.mode, "degraded");
  assert.equal(health.ok, false);
  assert.equal(health.ready, false);
}

async function testMissingTelegramPrerequisitesIsNotReady() {
  const health = await createRealHealth(
    createLiveEnv({
      TELEGRAM_BOT_TOKEN: null
    }),
    {
      ok: true,
      mode: "live",
      message: "Database connection is healthy",
      timestamp: new Date().toISOString()
    }
  );

  assert.equal(health.mode, "degraded");
  assert.equal(health.ok, true);
  assert.equal(health.ready, false);
}

async function testConfigFromProcessEnvOnly() {
  const projectDir = createTempProject("BOSE-config-process-");
  const result = runNode([checkLaunchConfigScript, "--project-dir", projectDir], {
    env: buildChildEnv(createLiveEnv())
  });

  assert.equal(result.status, 0, collectOutput(result));
  assert.match(collectOutput(result), /CONFIG_OK/);
}

async function testQuotedDotenvValues() {
  const projectDir = createTempProject(
    "BOSE-config-quoted-",
    [
      "DISET_DEFAULT_COMPANY_ID=company_demo",
      "APP_BASE_URL=\"https://bose.example.com\"",
      "POSTGRES_HOST=localhost",
      "POSTGRES_DATABASE=bose",
      "POSTGRES_USER=user",
      "POSTGRES_PASSWORD=secret",
      "TELEGRAM_BOT_TOKEN='telegram-secret-token'"
    ].join("\n")
  );
  const result = runNode([checkLaunchConfigScript, "--project-dir", projectDir], {
    env: buildChildEnv()
  });

  assert.equal(result.status, 0, collectOutput(result));
}

async function testLocalFallbackDotenv() {
  const projectDir = createTempProject(
    "BOSE-config-local-",
    [
      "DISET_DEFAULT_COMPANY_ID=company_demo",
      "APP_BASE_URL=https://bose.example.com",
      "POSTGRES_HOST=localhost",
      "POSTGRES_DATABASE=bose",
      "POSTGRES_USER=user",
      "POSTGRES_PASSWORD=secret",
      "TELEGRAM_BOT_TOKEN=telegram-secret-token"
    ].join("\n")
  );
  const result = runNode([checkLaunchConfigScript, "--project-dir", projectDir], {
    env: buildChildEnv()
  });

  assert.equal(result.status, 0, collectOutput(result));
}

async function testMissingLocalEnvButProcessEnvFull() {
  const projectDir = createTempProject("BOSE-config-no-local-");
  const result = runNode([checkLaunchConfigScript, "--project-dir", projectDir], {
    env: buildChildEnv(createLiveEnv())
  });

  assert.equal(result.status, 0, collectOutput(result));
}

async function testMissingRequiredConfigFails() {
  const projectDir = createTempProject("BOSE-config-missing-");
  const result = runNode([checkLaunchConfigScript, "--project-dir", projectDir], {
    env: buildChildEnv({
      DISET_DEFAULT_COMPANY_ID: "company_demo"
    })
  });

  assert.notEqual(result.status, 0);
  assert.match(collectOutput(result), /Missing required core variables/);
}

async function testSecretsAreNotPrinted() {
  const projectDir = createTempProject("BOSE-config-secret-");
  const secretToken = "super-secret-telegram-token";
  const result = runNode([checkLaunchConfigScript, "--project-dir", projectDir], {
    env: buildChildEnv({
      DISET_DEFAULT_COMPANY_ID: "company_demo",
      APP_BASE_URL: "https://bose.example.com",
      TELEGRAM_BOT_TOKEN: secretToken
    })
  });

  const output = collectOutput(result);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(output, new RegExp(secretToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

async function testHttpContractLiveReady() {
  const health = await createRealHealth(createLiveEnv(), {
    ok: true,
    mode: "live",
    message: "Database connection is healthy",
    timestamp: new Date().toISOString()
  });

  assert.equal(getSystemHealthHttpStatus(health), 200);
}

async function testHttpContractMock() {
  const health = await createRealHealth(
    {
      DISET_DEFAULT_COMPANY_ID: "company_demo",
      APP_BASE_URL: "https://bose.example.com",
      TELEGRAM_BOT_TOKEN: "telegram-secret-token"
    },
    {
      ok: false,
      mode: "mock",
      message: "Missing environment variables for the live database"
    }
  );

  assert.equal(getSystemHealthHttpStatus(health), 503);
}

async function testHttpContractDegraded() {
  const health = await createRealHealth(createLiveEnv(), {
    ok: false,
    mode: "degraded",
    message: "Database health check failed: connect timeout"
  });

  assert.equal(getSystemHealthHttpStatus(health), 503);
}

async function testHttpContractMisconfigured() {
  const health = await createRealHealth(
    {
      DISET_DEFAULT_COMPANY_ID: "company_demo",
      APP_BASE_URL: "https://bose.example.com",
      POSTGRES_HOST: "localhost",
      TELEGRAM_BOT_TOKEN: "telegram-secret-token"
    },
    {
      ok: false,
      mode: "mock",
      message: "Missing environment variables for the live database"
    }
  );

  assert.equal(getSystemHealthHttpStatus(health), 503);
}

async function testHttpContractInternalError() {
  const health = createInternalSystemHealth();

  assert.equal(health.mode, "degraded");
  assert.equal(health.ok, false);
  assert.equal(health.ready, false);
}

async function testRuntimeUnavailableFails() {
  const probeServer = http.createServer((request, response) => {
    response.writeHead(200);
    response.end("unused");
  });

  await new Promise((resolve) => probeServer.listen(0, "127.0.0.1", resolve));
  const address = probeServer.address();
  await new Promise((resolve, reject) =>
    probeServer.close((error) => (error ? reject(error) : resolve()))
  );

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const result = runNode([checkSystemScript, "--require-ready", "--base-url", baseUrl, "--timeout-ms", "200"]);

  assert.notEqual(result.status, 0);
  assert.match(collectOutput(result), /Runtime is unavailable/);
}

async function testMalformedHealthJsonFails() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end("{not-json}");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const result = await runNodeAsync([
      checkSystemScript,
      "--require-ready",
      "--base-url",
      baseUrl,
      "--timeout-ms",
      "1200"
    ]);

    assert.notEqual(result.status, 0);
    assert.match(collectOutput(result), /Malformed JSON/);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function testRuntimeFailsOnHttp503Json() {
  const health = await createRealHealth(
    {
      DISET_DEFAULT_COMPANY_ID: "company_demo",
      APP_BASE_URL: "https://bose.example.com",
      TELEGRAM_BOT_TOKEN: "telegram-secret-token"
    },
    {
      ok: false,
      mode: "mock",
      message: "Missing environment variables for the live database"
    }
  );

  await withHealthServer(503, health, async (baseUrl) => {
    const result = await runNodeAsync([
      checkSystemScript,
      "--require-ready",
      "--base-url",
      baseUrl,
      "--timeout-ms",
      "1200"
    ]);

    assert.notEqual(result.status, 0);
    assert.match(collectOutput(result), /Health is not ready/);
    assert.match(collectOutput(result), /mode=mock/);
  });
}

async function testRuntimeFailsOnHttp200ReadyFalse() {
  const health = await createRealHealth(createLiveEnv(), {
    ok: true,
    mode: "live",
    message: "Database connection is healthy",
    timestamp: new Date().toISOString()
  });
  const tamperedHealth = { ...health, status: "warn", ready: false };

  await withHealthServer(200, tamperedHealth, async (baseUrl) => {
    const result = await runNodeAsync([
      checkSystemScript,
      "--require-ready",
      "--base-url",
      baseUrl,
      "--timeout-ms",
      "1200"
    ]);

    assert.notEqual(result.status, 0);
    assert.match(collectOutput(result), /ready=false/);
  });
}

async function testRuntimeFailsOnHttp200ModeMock() {
  const health = await createRealHealth(createLiveEnv(), {
    ok: true,
    mode: "live",
    message: "Database connection is healthy",
    timestamp: new Date().toISOString()
  });
  const tamperedHealth = {
    ...health,
    status: "warn",
    mode: "mock",
    ready: false,
    warnings: ["Mock mode is active."]
  };

  await withHealthServer(200, tamperedHealth, async (baseUrl) => {
    const result = await runNodeAsync([
      checkSystemScript,
      "--require-ready",
      "--base-url",
      baseUrl,
      "--timeout-ms",
      "1200"
    ]);

    assert.notEqual(result.status, 0);
    assert.match(collectOutput(result), /mode=mock/);
  });
}

const tests = [
  { name: "start-dev missing .env.local", fn: testStartDevMissingLocalEnv },
  { name: "live DB without POSTGRES_PORT", fn: testLiveDbWithoutPort },
  { name: "live DB without POSTGRES_SSL", fn: testLiveDbWithoutSsl },
  { name: "mock fallback classification", fn: testMockFallbackClassification },
  { name: "partial DB config is misconfigured", fn: testPartialDbConfigIsMisconfigured },
  { name: "DB runtime failure is degraded", fn: testDatabaseRuntimeFailureIsDegraded },
  { name: "missing Telegram prerequisites is not ready", fn: testMissingTelegramPrerequisitesIsNotReady },
  { name: "config from process.env only", fn: testConfigFromProcessEnvOnly },
  { name: "quoted dotenv values", fn: testQuotedDotenvValues },
  { name: "local fallback dotenv", fn: testLocalFallbackDotenv },
  { name: "missing .env.local but process.env full", fn: testMissingLocalEnvButProcessEnvFull },
  { name: "missing required config fails", fn: testMissingRequiredConfigFails },
  { name: "secrets are not printed", fn: testSecretsAreNotPrinted },
  { name: "HTTP contract live ready", fn: testHttpContractLiveReady },
  { name: "HTTP contract mock", fn: testHttpContractMock },
  { name: "HTTP contract degraded", fn: testHttpContractDegraded },
  { name: "HTTP contract misconfigured", fn: testHttpContractMisconfigured },
  { name: "HTTP contract internal error", fn: testHttpContractInternalError },
  { name: "runtime unavailable fails", fn: testRuntimeUnavailableFails },
  { name: "malformed health JSON fails", fn: testMalformedHealthJsonFails },
  { name: "runtime fails on HTTP 503 JSON", fn: testRuntimeFailsOnHttp503Json },
  { name: "runtime fails on HTTP 200 ready false", fn: testRuntimeFailsOnHttp200ReadyFalse },
  { name: "runtime fails on HTTP 200 mode mock", fn: testRuntimeFailsOnHttp200ModeMock }
];

async function main() {
  const results = [];

  for (const test of tests) {
    try {
      await test.fn();
      results.push({ name: test.name, ok: true });
      console.log(`PASS ${test.name}`);
    } catch (error) {
      results.push({ name: test.name, ok: false, error: error.message });
      console.error(`FAIL ${test.name}: ${error.message}`);
    }
  }

  console.log(JSON.stringify(results, null, 2));

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
