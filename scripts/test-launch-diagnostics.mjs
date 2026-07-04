import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluateSystemHealth } from "../lib/system-health-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const startDevScript = path.join(repoRoot, "start-dev.ps1");
const checkSystemScript = path.join(repoRoot, "scripts", "check-system.mjs");
const checkLaunchConfigScript = path.join(repoRoot, "scripts", "check-launch-config.mjs");

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
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

function createHealthPayload({
  status,
  mode,
  ready,
  warnings = [],
  database = {},
  telegram = {}
}) {
  return {
    status,
    mode,
    ready,
    database: {
      configured: Boolean(database.configured),
      ok: Boolean(database.ok),
      mode: database.mode || mode,
      message: database.message || "diagnostic",
      checkedAt: database.checkedAt || new Date().toISOString()
    },
    telegram: {
      configured: Boolean(telegram.configured),
      botReady: Boolean(telegram.botReady),
      appUrlReady: Boolean(telegram.appUrlReady),
      analyticsEnabled: Boolean(telegram.analyticsEnabled),
      launchMetricsEnabled: Boolean(telegram.launchMetricsEnabled)
    },
    warnings,
    timestamp: new Date().toISOString()
  };
}

async function withServer(handler, callback) {
  const server = http.createServer(handler);

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

function createRouteHandler(healthResponse, healthStatusCode = 200) {
  const healthBody =
    typeof healthResponse === "string"
      ? healthResponse
      : JSON.stringify(healthResponse);

  const handler = (request, response) => {
    if (request.url === "/api/system/health") {
      response.writeHead(healthStatusCode, { "Content-Type": "application/json" });
      response.end(healthBody);
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
  };
  return handler;
}

async function testStartDevMissingLocalEnv() {
  const tempDir = makeTempDir("BOSE Диагностика ");
  const tempScript = path.join(tempDir, "start-dev.ps1");
  const envExamplePath = path.join(tempDir, ".env.example");
  const envLocalPath = path.join(tempDir, ".env.local");

  fs.copyFileSync(startDevScript, tempScript);
  writeFile(envExamplePath, "APP_BASE_URL=https://example.com\n");

  const result = runPowerShell(["-File", tempScript], { cwd: tempDir });
  const output = collectOutput(result);

  assert.notEqual(result.status, 0, "start-dev.ps1 should fail without .env.local");
  assert.match(output, /Missing local environment file:/);
  assert.match(output, /Copy-Item -LiteralPath/);
  assert.equal(fs.existsSync(envLocalPath), false, ".env.local must not be auto-created");
}

async function testLaunchConfigReady() {
  const tempDir = makeTempDir("BOSE Config Ready ");
  const envExamplePath = path.join(tempDir, ".env.example");
  const envLocalPath = path.join(tempDir, ".env.local");

  writeFile(envExamplePath, "# template\n");
  writeFile(
    envLocalPath,
    [
      "DISET_DEFAULT_COMPANY_ID=company_demo",
      "APP_BASE_URL=https://bose.example.com",
      "POSTGRES_HOST=localhost",
      "POSTGRES_DATABASE=bose",
      "POSTGRES_USER=user",
      "POSTGRES_PASSWORD=secret",
      "TELEGRAM_BOT_TOKEN=test-token"
    ].join("\n")
  );

  const result = runNode([
    checkLaunchConfigScript,
    "--env-example",
    envExamplePath,
    "--env-local",
    envLocalPath
  ]);

  assert.equal(result.status, 0, collectOutput(result));
  assert.match(collectOutput(result), /CONFIG_OK/);
}

async function testHealthCoreMissingRequiredEnv() {
  const health = evaluateSystemHealth({
    env: {
      ok: false,
      requiredMissing: ["APP_BASE_URL"],
      database: { liveReady: false, configured: 0, total: 6 },
      telegram: { botReady: false }
    },
    database: { ok: false, mode: "mock", message: "Missing database env" },
    telegram: { configured: false },
    analytics: { enabled: false, appUrlReady: false },
    launchMetrics: { enabled: false }
  });

  assert.equal(health.mode, "misconfigured");
  assert.equal(health.ready, false);
  assert.equal(health.status, "error");
}

async function testLaunchConfigMissingRequiredEnv() {
  const tempDir = makeTempDir("BOSE Config Missing ");
  const envExamplePath = path.join(tempDir, ".env.example");
  const envLocalPath = path.join(tempDir, ".env.local");

  writeFile(envExamplePath, "# template\n");
  writeFile(
    envLocalPath,
    [
      "DISET_DEFAULT_COMPANY_ID=company_demo",
      "POSTGRES_HOST=localhost",
      "POSTGRES_DATABASE=bose",
      "POSTGRES_USER=user",
      "POSTGRES_PASSWORD=secret",
      "TELEGRAM_BOT_TOKEN=test-token"
    ].join("\n")
  );

  const result = runNode([
    checkLaunchConfigScript,
    "--env-example",
    envExamplePath,
    "--env-local",
    envLocalPath
  ]);

  assert.notEqual(result.status, 0, "missing APP_BASE_URL must fail");
  assert.match(collectOutput(result), /Missing required core variables/);
}

async function testHealthCoreMockMode() {
  const health = evaluateSystemHealth({
    env: {
      ok: true,
      requiredMissing: [],
      database: { liveReady: false, configured: 0, total: 6 },
      telegram: { botReady: false }
    },
    database: { ok: false, mode: "mock", message: "Using fallback" },
    telegram: { configured: false },
    analytics: { enabled: false, appUrlReady: false },
    launchMetrics: { enabled: false }
  });

  assert.equal(health.mode, "mock");
  assert.equal(health.ready, false);
  assert.equal(health.status, "warn");
  assert.match(health.warnings.join("\n"), /mock\/fallback mode/i);
}

async function testHealthCoreLiveReadyMode() {
  const health = evaluateSystemHealth({
    env: {
      ok: true,
      requiredMissing: [],
      database: { liveReady: true, configured: 6, total: 6 },
      telegram: { botReady: true }
    },
    database: {
      ok: true,
      mode: "live",
      message: "Database connection is healthy",
      timestamp: new Date().toISOString()
    },
    telegram: { configured: true },
    analytics: { enabled: true, appUrlReady: true },
    launchMetrics: { enabled: true }
  });

  assert.equal(health.mode, "live");
  assert.equal(health.ready, true);
  assert.equal(health.status, "ok");
}

async function testRuntimeGateMockModeFails() {
  const payload = createHealthPayload({
    status: "warn",
    mode: "mock",
    ready: false,
    warnings: ["Mock mode is active."]
  });

  await withServer(createRouteHandler(payload), async (baseUrl) => {
    const result = await runNodeAsync([
      checkSystemScript,
      "--base-url",
      baseUrl,
      "--timeout-ms",
      "1200",
      "--require-ready"
    ]);

    assert.notEqual(result.status, 0, "mock mode must fail release gate");
    assert.match(collectOutput(result), /Release gate failed/);
  });
}

async function testRuntimeGateLiveModePasses() {
  const payload = createHealthPayload({
    status: "ok",
    mode: "live",
    ready: true,
    warnings: [],
    database: { configured: true, ok: true, mode: "live" },
    telegram: {
      configured: true,
      botReady: true,
      appUrlReady: true,
      analyticsEnabled: true,
      launchMetricsEnabled: true
    }
  });

  await withServer(createRouteHandler(payload), async (baseUrl) => {
    const result = await runNodeAsync([
      checkSystemScript,
      "--base-url",
      baseUrl,
      "--timeout-ms",
      "1200",
      "--require-ready"
    ]);

    assert.equal(result.status, 0, collectOutput(result));
    assert.match(collectOutput(result), /SYSTEM_READY_OK/);
  });
}

async function testRuntimeUnavailableFailsClearly() {
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
  const result = runNode([
    checkSystemScript,
    "--base-url",
    baseUrl,
    "--timeout-ms",
    "200",
    "--require-ready"
  ]);

  assert.notEqual(result.status, 0, "runtime outage must fail");
  assert.match(collectOutput(result), /Runtime is unavailable/);
  assert.match(collectOutput(result), /npm run dev/);
}

async function testMalformedHealthJsonFails() {
  await withServer(createRouteHandler("{not-json}", 200), async (baseUrl) => {
    const result = await runNodeAsync([
      checkSystemScript,
      "--base-url",
      baseUrl,
      "--timeout-ms",
      "1200",
      "--require-ready"
    ]);

    assert.notEqual(result.status, 0, "malformed JSON must fail");
    assert.match(collectOutput(result), /Malformed JSON/);
  });
}

const tests = [
  { name: "start-dev missing .env.local", fn: testStartDevMissingLocalEnv },
  { name: "launch config ready", fn: testLaunchConfigReady },
  { name: "health core missing required env", fn: testHealthCoreMissingRequiredEnv },
  { name: "launch config missing required env", fn: testLaunchConfigMissingRequiredEnv },
  { name: "health core mock mode", fn: testHealthCoreMockMode },
  { name: "health core live ready mode", fn: testHealthCoreLiveReadyMode },
  { name: "runtime gate fails in mock mode", fn: testRuntimeGateMockModeFails },
  { name: "runtime gate passes in live mode", fn: testRuntimeGateLiveModePasses },
  { name: "runtime gate fails when app is down", fn: testRuntimeUnavailableFailsClearly },
  { name: "runtime gate fails on malformed health JSON", fn: testMalformedHealthJsonFails }
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
