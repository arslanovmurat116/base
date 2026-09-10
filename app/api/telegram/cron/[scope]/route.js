import { NextResponse } from "next/server";
import {
  getTelegramControlStatus,
  runTelegramDispatchScope
} from "../../../../../lib/telegram-control";

function hasValidCronRequest(request) {
  const expectedSecret = String(process.env.CRON_SECRET || "").trim();
  const authHeader = request.headers.get("authorization") || "";

  if (!expectedSecret) return process.env.NODE_ENV !== "production";
  return authHeader === `Bearer ${expectedSecret}`;
}

function buildUnauthorizedResponse(status = 401) {
  return NextResponse.json(
    {
      ok: false,
      message: "Cron dispatch is not authorized"
    },
    { status }
  );
}

export async function GET(request, context) {
  if (!hasValidCronRequest(request)) {
    return buildUnauthorizedResponse();
  }

  const params = await Promise.resolve(context?.params);
  const scope = params?.scope;
  const searchParams = request.nextUrl.searchParams;
  const result = await runTelegramDispatchScope(scope, {
    dryRun: false,
    force: ["1", "true", "yes", "on"].includes(
      String(searchParams.get("force") || "").toLowerCase()
    ),
    chatId: searchParams.get("chatId")
  });

  return NextResponse.json(
    {
      ...result,
      scope,
      status: await getTelegramControlStatus()
    },
    {
      status: result.ok ? 200 : result.status || 400
    }
  );
}
