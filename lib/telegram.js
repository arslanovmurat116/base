import fs from "node:fs";
import path from "node:path";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");

    if (index === -1) {
      continue;
    }

    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }

  return env;
}

export function getTelegramBotToken() {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "../deploy/.env.local"),
    path.resolve(process.cwd(), "../../deploy/.env.local")
  ];

  for (const filePath of candidates) {
    const env = parseEnvFile(filePath);

    if (env.TELEGRAM_BOT_TOKEN) {
      return env.TELEGRAM_BOT_TOKEN;
    }
  }

  return null;
}

export function isTelegramBotConfigured() {
  return Boolean(getTelegramBotToken());
}

export function getTelegramBotSecretToken() {
  return process.env.TELEGRAM_BOT_SECRET_TOKEN || null;
}

async function callTelegramBotApi(method, payload) {
  const token = getTelegramBotToken();

  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
  }

  return data.result;
}

export async function sendTelegramBotMessage(chatId, text, options = {}) {
  return callTelegramBotApi("sendMessage", {
    chat_id: chatId,
    text,
    ...options
  });
}

export async function answerTelegramCallbackQuery(callbackQueryId, text, options = {}) {
  return callTelegramBotApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    ...options
  });
}
