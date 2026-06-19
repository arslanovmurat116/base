import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const appDir = process.cwd();
const envLocalPath = path.join(appDir, ".env.local");
const offsetFilePath = path.join(appDir, ".mock-state", "telegram-update-offset.json");
const DEFAULT_UPDATE_OFFSET_KEY = "local-polling-default";

export function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const result = {};

  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    result[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1).trim();
  }

  return result;
}

export function loadTelegramConfig() {
  const fileEnv = parseEnvFile(envLocalPath);

  return {
    token: process.env.TELEGRAM_BOT_TOKEN || fileEnv.TELEGRAM_BOT_TOKEN || "",
    secret: process.env.TELEGRAM_BOT_SECRET_TOKEN || fileEnv.TELEGRAM_BOT_SECRET_TOKEN || "",
    baseUrl: (process.env.APP_BASE_URL || fileEnv.APP_BASE_URL || "http://localhost:3004").replace(
      /\/+$/,
      ""
    )
  };
}

function readUpdateOffsetFromFile() {
  try {
    if (!fs.existsSync(offsetFilePath)) {
      return 0;
    }

    const payload = JSON.parse(fs.readFileSync(offsetFilePath, "utf-8"));
    return Number(payload.offset || 0);
  } catch {
    return 0;
  }
}

function writeUpdateOffsetToFile(offset) {
  fs.mkdirSync(path.dirname(offsetFilePath), { recursive: true });
  fs.writeFileSync(
    offsetFilePath,
    JSON.stringify(
      {
        offset,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf-8"
  );
}

function loadRuntimeEnv() {
  const fileEnv = parseEnvFile(envLocalPath);
  return {
    ...fileEnv,
    ...process.env
  };
}

function loadPostgresRuntimeConfig() {
  const env = loadRuntimeEnv();
  const companyId = env.DISET_DEFAULT_COMPANY_ID || null;
  const enabled = Boolean(
    companyId &&
      env.POSTGRES_HOST &&
      env.POSTGRES_DATABASE &&
      env.POSTGRES_USER &&
      env.POSTGRES_PASSWORD
  );

  return {
    enabled,
    companyId,
    consumerKey: env.TELEGRAM_UPDATE_OFFSET_KEY || DEFAULT_UPDATE_OFFSET_KEY,
    host: env.POSTGRES_HOST || "",
    port: Number(env.POSTGRES_PORT || 5432),
    database: env.POSTGRES_DATABASE || "",
    user: env.POSTGRES_USER || "",
    password: env.POSTGRES_PASSWORD || "",
    ssl: env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false
  };
}

async function withRuntimeDb(run) {
  const config = loadPostgresRuntimeConfig();

  if (!config.enabled) {
    return null;
  }

  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl
  });

  await client.connect();

  try {
    return await run(client, config);
  } finally {
    await client.end();
  }
}

export async function readUpdateOffset() {
  const fileOffset = readUpdateOffsetFromFile();

  try {
    const dbOffset = await withRuntimeDb(async (client, config) => {
      const result = await client.query(
        `
          select offset_value
          from telegram_update_offsets
          where company_id = $1
            and consumer_key = $2
          limit 1
        `,
        [config.companyId, config.consumerKey]
      );

      if (result.rows[0]?.offset_value != null) {
        return Number(result.rows[0].offset_value || 0);
      }

      if (fileOffset > 0) {
        await client.query(
          `
            insert into telegram_update_offsets (
              company_id,
              consumer_key,
              offset_value,
              updated_at
            )
            values ($1, $2, $3, now())
            on conflict (company_id, consumer_key)
            do update set
              offset_value = excluded.offset_value,
              updated_at = now()
          `,
          [config.companyId, config.consumerKey, fileOffset]
        );
      }

      return fileOffset;
    });

    if (dbOffset != null && !Number.isNaN(dbOffset)) {
      return dbOffset;
    }
  } catch {
    return fileOffset;
  }

  return fileOffset;
}

export async function writeUpdateOffset(offset) {
  const normalizedOffset = Number(offset || 0);

  try {
    const persisted = await withRuntimeDb(async (client, config) => {
      await client.query(
        `
          insert into telegram_update_offsets (
            company_id,
            consumer_key,
            offset_value,
            updated_at
          )
          values ($1, $2, $3, now())
          on conflict (company_id, consumer_key)
          do update set
            offset_value = excluded.offset_value,
            updated_at = now()
        `,
        [config.companyId, config.consumerKey, normalizedOffset]
      );

      return true;
    });

    if (persisted) {
      return;
    }
  } catch {
    writeUpdateOffsetToFile(normalizedOffset);
    return;
  }

  writeUpdateOffsetToFile(normalizedOffset);
}

export async function callTelegramApi(token, method, payload = null) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: payload ? "POST" : "GET",
    headers: payload
      ? {
          "Content-Type": "application/json"
        }
      : undefined,
    body: payload ? JSON.stringify(payload) : undefined
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
  }

  return data.result;
}

export async function fetchTelegramUpdates(token, offset, timeoutSeconds = 0) {
  return callTelegramApi(token, "getUpdates", {
    offset,
    timeout: timeoutSeconds,
    allowed_updates: ["message", "callback_query"]
  });
}

export async function forwardUpdateToLocalWebhook(baseUrl, secret, update) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (secret) {
    headers["x-telegram-bot-api-secret-token"] = secret;
  }

  const response = await fetch(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify(update)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Local webhook returned ${response.status}: ${JSON.stringify(data || {})}`
    );
  }

  return data;
}
