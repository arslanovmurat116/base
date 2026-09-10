import { NextResponse } from "next/server";
import {
  getTelegramControlStatus,
  runTelegramDispatch
} from "../../../../lib/telegram-control";

function parseBooleanFlag(value, fallbackValue) {
  if (value === null || value === undefined || value === "") {
    return fallbackValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function hasDispatchAuthorization(request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const expectedSecret = String(process.env.CRON_SECRET || "").trim();

  if (!expectedSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${expectedSecret}`;
}

function buildUnauthorizedResponse() {
  return NextResponse.json(
    {
      ok: false,
      message: "Live Telegram dispatch is not authorized"
    },
    { status: 401 }
  );
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const dryRun = parseBooleanFlag(searchParams.get("dryRun"), true);

  if (!dryRun && !hasDispatchAuthorization(request)) {
    return buildUnauthorizedResponse();
  }

  const result = await runTelegramDispatch({
    dryRun,
    force: parseBooleanFlag(searchParams.get("force"), false),
    mode: searchParams.get("mode"),
    role: searchParams.get("role"),
    chatId: searchParams.get("chatId")
  });

  return NextResponse.json({
    ...result,
    status: await getTelegramControlStatus()
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const dryRun = body?.dryRun !== false;

  if (!dryRun && !hasDispatchAuthorization(request)) {
    return buildUnauthorizedResponse();
  }

  const result = await runTelegramDispatch({
    dryRun,
    force: body?.force === true,
    mode: body?.mode || null,
    role: body?.role || null,
    chatId: body?.chatId || null
  });

  return NextResponse.json({
    ...result,
    status: await getTelegramControlStatus()
  });
}
