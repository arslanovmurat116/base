import fs from "node:fs";
import path from "node:path";

const appDir = process.cwd();
const envLocalPath = path.join(appDir, ".env.local");
const offsetFilePath = path.join(appDir, ".mock-state", "telegram-update-offset.json");

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

export function readUpdateOffset() {
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

export function writeUpdateOffset(offset) {
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
