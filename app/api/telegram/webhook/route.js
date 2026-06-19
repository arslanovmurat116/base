import { NextResponse } from "next/server";
import {
  getTelegramControlStatus,
  handleTelegramWebhookUpdate
} from "../../../../lib/telegram-control";
import { getTelegramBotSecretToken } from "../../../../lib/telegram";

function hasValidSecret(request) {
  const expectedSecret = getTelegramBotSecretToken();

  if (!expectedSecret) {
    return true;
  }

  return request.headers.get("x-telegram-bot-api-secret-token") === expectedSecret;
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
