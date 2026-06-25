import { NextResponse } from "next/server";
import {
  getTelegramControlStatus,
  handleTelegramWebhookUpdate
} from "../../../../lib/telegram-control";
import { getTelegramBotSecretToken } from "../../../../lib/telegram";
import {
  recordTelegramBotTouch,
  trackTelegramAnalyticsEvent
} from "../../../../lib/telegram/analytics";

function hasValidSecret(request) {
  const expectedSecret = getTelegramBotSecretToken();

  if (!expectedSecret) {
    return true;
  }

  return request.headers.get("x-telegram-bot-api-secret-token") === expectedSecret;
}

function extractTelegramTouch(update = {}) {
  const message = update?.message || update?.edited_message || update?.callback_query?.message || null;
  const from = update?.message?.from || update?.edited_message?.from || update?.callback_query?.from || null;
  const text = String(update?.message?.text || update?.edited_message?.text || "").trim();
  const isStartCommand = /^\/start\b/i.test(text);
  const startParam = isStartCommand ? text.replace(/^\/start\b/i, "").trim() || null : null;

  if (!from?.id) {
    return null;
  }

  return {
    telegramUserId: String(from.id),
    chatId: message?.chat?.id ? String(message.chat.id) : null,
    username: from.username || null,
    firstName: from.first_name || null,
    lastName: from.last_name || null,
    languageCode: from.language_code || null,
    isPremium: Boolean(from.is_premium),
    botStarted: isStartCommand,
    startParam,
    command: text.startsWith("/") ? text.split(/\s+/)[0].toLowerCase() : null,
    platform: "telegram-bot",
    appVersion: "rc1",
    timestamp: new Date().toISOString()
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: await getTelegramControlStatus()
  });
}

export async function POST(request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Webhook secret token mismatch"
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const touch = extractTelegramTouch(body);

    if (touch) {
      await recordTelegramBotTouch(touch).catch(() => null);
    }

    if (body?.callback_query?.from?.id && body?.callback_query?.data) {
      await trackTelegramAnalyticsEvent({
        telegramUserId: String(body.callback_query.from.id),
        chatId: body.callback_query.message?.chat?.id
          ? String(body.callback_query.message.chat.id)
          : null,
        username: body.callback_query.from.username || null,
        languageCode: body.callback_query.from.language_code || null,
        platform: "telegram-bot",
        appVersion: "rc1",
        eventName: "button_click",
        eventPayload: {
          callbackData: body.callback_query.data
        },
        timestamp: new Date().toISOString()
      }).catch(() => null);
    }

    const result = await handleTelegramWebhookUpdate(body);

    return NextResponse.json(result, {
      status: 200
    });
  } catch (error) {
    console.warn("Telegram webhook handler failed:", error.message);

    return NextResponse.json(
      {
        ok: false,
        message: "Webhook обработан с ошибкой",
        error: error.message
      },
      { status: 200 }
    );
  }
}
