import { callTelegramApi, loadTelegramConfig } from "./telegram-common.mjs";

const action = (process.argv[2] || "info").toLowerCase();

function getWebhookUrl(baseUrl) {
  return `${baseUrl.replace(/\/+$/, "")}/api/telegram/webhook`;
}

function ensureHttpsUrl(baseUrl) {
  if (!/^https:\/\//i.test(baseUrl)) {
    throw new Error(
      "APP_BASE_URL должен быть публичным https-адресом, чтобы Telegram принял webhook."
    );
  }
}

async function main() {
  const config = loadTelegramConfig();

  if (!config.token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  if (action === "info") {
    const result = await callTelegramApi(config.token, "getWebhookInfo");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (action === "me") {
    const result = await callTelegramApi(config.token, "getMe");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (action === "delete" || action === "clear") {
    const result = await callTelegramApi(config.token, "deleteWebhook", {
      drop_pending_updates: false
    });
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (action === "set") {
    ensureHttpsUrl(config.baseUrl);
    const webhookUrl = getWebhookUrl(config.baseUrl);
    const payload = {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"]
    };

    if (config.secret) {
      payload.secret_token = config.secret;
    }

    const result = await callTelegramApi(config.token, "setWebhook", payload);
    console.log(
      JSON.stringify(
        {
          ok: true,
          webhookUrl,
          result
        },
        null,
        2
      )
    );
    return;
  }

  if (action === "commands") {
    const result = await callTelegramApi(config.token, "setMyCommands", {
      commands: [
        { command: "start", description: "Запуск и помощь" },
        { command: "help", description: "Список команд" },
        { command: "register", description: "Привязать роль и имя" },
        { command: "status", description: "Проверить привязку чата" },
        { command: "today", description: "Сводка на сегодня" },
        { command: "control", description: "Контроль по срокам и замерам" },
        { command: "alerts", description: "Просрочки и возвраты" },
        { command: "appointments", description: "Замеры и встречи" }
      ]
    });
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  throw new Error(`Неизвестное действие: ${action}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
