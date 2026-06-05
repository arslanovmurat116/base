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

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const result = await runTelegramDispatch({
    dryRun: parseBooleanFlag(searchParams.get("dryRun"), true),
    role: searchParams.get("role"),
    chatId: searchParams.get("chatId")
  });

  return NextResponse.json({
    ...result,
    status: getTelegramControlStatus()
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const result = await runTelegramDispatch({
    dryRun: body?.dryRun !== false,
    role: body?.role || null,
    chatId: body?.chatId || null
  });

  return NextResponse.json({
    ...result,
    status: getTelegramControlStatus()
  });
}
