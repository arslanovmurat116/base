import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import nextEnv from "@next/env";
import { Pool } from "pg";

const repoRoot = process.cwd();
const { loadEnvConfig } = nextEnv;

loadEnvConfig(repoRoot);

const requiredEnv = [
  "DISET_DEFAULT_COMPANY_ID",
  "TELEGRAM_BOT_TOKEN",
  "POSTGRES_HOST",
  "POSTGRES_DATABASE",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD"
];

const missingEnv = requiredEnv.filter((key) => !String(process.env[key] || "").trim());

if (missingEnv.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: "missing_env",
        missingEnv
      },
      null,
      2
    )
  );
  process.exit(1);
}

const buildIdPath = path.join(repoRoot, ".next", "BUILD_ID");

if (!fs.existsSync(buildIdPath)) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: "missing_build",
        message: "Run npm run build before test-miniapp-auth.mjs"
      },
      null,
      2
    )
  );
  process.exit(1);
}

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildDataCheckString(entries) {
  return Object.entries(entries)
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function buildTelegramInitData(user, options = {}) {
  const entries = {
    auth_date: String(options.authDate || Math.floor(Date.now() / 1000)),
    chat_instance: options.chatInstance || "codex-miniapp-auth-test",
    chat_type: options.chatType || "sender",
    query_id: options.queryId || crypto.randomUUID(),
    start_param: options.startParam || "codex-miniapp-auth-test",
    user: JSON.stringify(user)
  };
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(buildDataCheckString(entries))
    .digest("hex");
  const params = new URLSearchParams(entries);
  params.set("hash", hash);
  return params.toString();
}

async function findFreePort(start = 3221, end = 3299) {
  for (let port = start; port <= end; port += 1) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, "127.0.0.1");
    });

    if (available) {
      return port;
    }
  }

  throw new Error("No free port found for Mini App auth test");
}

async function waitForEndpoint(url, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "not_started";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }

      lastError = `http_${response.status}`;
    } catch (error) {
      lastError = error.message;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Runtime did not become ready: ${lastError}`);
}

function startRuntime(port) {
  const nextCliPath = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextCliPath, "start", "-p", String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [];

  child.stdout.on("data", (chunk) => {
    output.push(String(chunk));
  });

  child.stderr.on("data", (chunk) => {
    output.push(String(chunk));
  });

  return { child, output };
}

async function stopRuntime(child) {
  if (!child || child.exitCode != null) {
    return;
  }

  await new Promise((resolve) => {
    child.once("exit", () => resolve());
    child.kill();
    setTimeout(() => resolve(), 5000);
  });
}

async function postMiniAppAuth(baseUrl, initData, extraBody = {}) {
  const response = await fetch(`${baseUrl}/api/telegram/miniapp/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      initData,
      platform: "telegram-miniapp",
      device: "codex-test",
      telegramVersion: "9.6",
      appVersion: "rc1-test",
      screenPath: "/scenario-request",
      ...extraBody
    })
  });
  const body = await response.json();
  return {
    status: response.status,
    body
  };
}

async function getLatestIdentity(telegramUserId) {
  const result = await pool.query(
    `
      select id, telegram_user_id, telegram_username, first_seen_at, last_seen_at
      from telegram_identities
      where company_id = $1
        and telegram_user_id = $2::text
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1
    `,
    [process.env.DISET_DEFAULT_COMPANY_ID, String(telegramUserId)]
  );

  return result.rows[0] || null;
}

async function getLatestSession(telegramUserId) {
  const result = await pool.query(
    `
      select id, telegram_user_id, telegram_username, session_status, issued_at, expires_at
      from miniapp_sessions
      where company_id = $1
        and telegram_user_id = $2::text
      order by issued_at desc nulls last
      limit 1
    `,
    [process.env.DISET_DEFAULT_COMPANY_ID, String(telegramUserId)]
  );

  return result.rows[0] || null;
}

const results = [];

function record(name, passed, details, extra = {}) {
  results.push({
    name,
    passed: Boolean(passed),
    details,
    ...extra
  });
}

const testSeed = Date.now();
const userWithUsername = {
  id: 980000000 + (testSeed % 100000),
  first_name: "Codex",
  last_name: "Scenario",
  username: `codex_miniapp_auth_${testSeed}`,
  language_code: "ru"
};
const userWithoutUsername = {
  id: 981000000 + (testSeed % 100000),
  first_name: "Codex",
  last_name: "NoUsername",
  language_code: "ru"
};

const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const runtime = startRuntime(port);

try {
  await waitForEndpoint(`${baseUrl}/api/system/health`);

  const validInitData = buildTelegramInitData(userWithUsername);
  const firstAuth = await postMiniAppAuth(baseUrl, validInitData);
  const firstIdentity = await getLatestIdentity(userWithUsername.id);
  const firstSession = await getLatestSession(userWithUsername.id);

  record(
    "miniapp_auth_new_user_with_username",
    firstAuth.status === 200 &&
      firstAuth.body?.ok === true &&
      firstAuth.body?.profile?.telegramUserId === String(userWithUsername.id) &&
      firstAuth.body?.profile?.username === `@${userWithUsername.username}` &&
      Boolean(firstAuth.body?.session?.sessionToken) &&
      Boolean(firstIdentity?.id) &&
      Boolean(firstSession?.id),
    "Expected a new Telegram user with username to authenticate and create a live Mini App session.",
    {
      httpStatus: firstAuth.status
    }
  );

  const secondAuth = await postMiniAppAuth(baseUrl, buildTelegramInitData(userWithUsername));
  const secondIdentity = await getLatestIdentity(userWithUsername.id);
  const secondSession = await getLatestSession(userWithUsername.id);

  record(
    "miniapp_auth_repeat_existing_user",
    secondAuth.status === 200 &&
      secondAuth.body?.ok === true &&
      firstAuth.body?.profile?.id === secondAuth.body?.profile?.id &&
      firstIdentity?.id === secondIdentity?.id &&
      firstSession?.id !== secondSession?.id &&
      Boolean(secondAuth.body?.session?.sessionToken),
    "Expected a repeated login to reuse the same identity and issue a fresh session.",
    {
      httpStatus: secondAuth.status
    }
  );

  const nullUsernameAuth = await postMiniAppAuth(
    baseUrl,
    buildTelegramInitData(userWithoutUsername)
  );
  const nullUsernameIdentity = await getLatestIdentity(userWithoutUsername.id);
  const nullUsernameSession = await getLatestSession(userWithoutUsername.id);

  record(
    "miniapp_auth_without_username",
    nullUsernameAuth.status === 200 &&
      nullUsernameAuth.body?.ok === true &&
      nullUsernameAuth.body?.profile?.telegramUserId === String(userWithoutUsername.id) &&
      (nullUsernameAuth.body?.profile?.username == null) &&
      (nullUsernameIdentity?.telegram_username == null) &&
      Boolean(nullUsernameSession?.id),
    "Expected Telegram identity without username to authenticate and persist with null username.",
    {
      httpStatus: nullUsernameAuth.status
    }
  );

  record(
    "miniapp_auth_session_created",
    firstSession?.session_status === "ACTIVE" &&
      nullUsernameSession?.session_status === "ACTIVE",
    "Expected live Mini App sessions to be created in the database.",
    {
      sessionStatusWithUsername: firstSession?.session_status || null,
      sessionStatusWithoutUsername: nullUsernameSession?.session_status || null
    }
  );

  const invalidInitData = validInitData.replace(/.$/, (char) => (char === "a" ? "b" : "a"));
  const invalidAuth = await postMiniAppAuth(baseUrl, invalidInitData);

  record(
    "miniapp_auth_invalid_init_data_rejected",
    invalidAuth.body?.ok === false &&
      invalidAuth.body?.verification?.verified === false &&
      invalidAuth.body?.verification?.code === "invalid_hash",
    "Expected invalid initData to be rejected without session creation.",
    {
      httpStatus: invalidAuth.status
    }
  );

  const healthResponse = await fetch(`${baseUrl}/api/system/health`);
  const healthBody = await healthResponse.json();

  record(
    "miniapp_auth_runtime_health",
    healthResponse.status === 200 &&
      healthBody?.status === "ok" &&
      healthBody?.mode === "live" &&
      healthBody?.ready === true,
    "Expected the local production runtime health endpoint to stay live and ready during auth checks.",
    {
      httpStatus: healthResponse.status
    }
  );
} catch (error) {
  record("miniapp_auth_runtime_test", false, error.message, {
    outputTail: runtime.output.join("").split(/\r?\n/).filter(Boolean).slice(-20)
  });
} finally {
  await stopRuntime(runtime.child);
  await pool.end();
}

const failed = results.filter((item) => !item.passed);

if (failed.length > 0) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        port,
        results
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      port,
      results
    },
    null,
    2
  )
);
