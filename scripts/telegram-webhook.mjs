import { callTelegramApi, loadTelegramConfig } from "./telegram-common.mjs";

const action = (process.argv[2] || "info").toLowerCase();

function getWebhookUrl(baseUrl) {
  try {
    const base = new URL(baseUrl);
    const webhookUrl = new URL("/api/telegram/webhook", base);

    for (const [key, value] of base.searchParams.entries()) {
      if (!webhookUrl.searchParams.has(key)) {
        webhookUrl.searchParams.append(key, value);
      }
    }

    return webhookUrl.toString();
  } catch {
    return `${baseUrl.replace(/\/+$/, "")}/api/telegram/webhook`;
  }
}

function ensureHttpsUrl(baseUrl) {
  if (!/^https:\/\//i.test(baseUrl)) {
    throw new Error("APP_BASE_URL must be a public https URL for Telegram webhook setup.");
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
        { command: "start", description: "Open BOSE and help" },
        { command: "help", description: "Show commands" },
        { command: "register", description: "Register team role" },
        { command: "status", description: "Show chat status" },
        { command: "app", description: "Open BOSE workspace" },
        { command: "add", description: "Open bot actions" },
        { command: "today", description: "Today summary" },
        { command: "summary", description: "AI daily summary" },
        { command: "control", description: "Control queues" },
        { command: "alerts", description: "Overdue alerts" },
        { command: "appointments", description: "Appointments" },
        { command: "clients", description: "Open clients" },
        { command: "deals", description: "Open deals" },
        { command: "tasks", description: "Open tasks" },
        { command: "ai", description: "Open AI assistant" },
        { command: "demo", description: "Describe what to automate" },
        { command: "scenario", description: "Order a workflow scenario" },
        { command: "newclient", description: "Create client" },
        { command: "newdeal", description: "Create deal" },
        { command: "newtask", description: "Create task" },
        { command: "followup", description: "Create follow-up" },
        { command: "askai", description: "Ask BOSE AI" },
        { command: "feedback", description: "Send feedback" },
        { command: "feature", description: "Request feature" },
        { command: "support", description: "Request support" },
        { command: "file", description: "Send file for review" }
      ]
    });
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  throw new Error(`Unknown action: ${action}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
