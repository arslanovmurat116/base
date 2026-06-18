import { NextResponse } from "next/server";
import { cleanupDemoState } from "../../../../../lib/demo-state-cleanup.js";

function getAuthorizedTokens() {
  return [
    process.env.CRON_SECRET,
    process.env.DEMO_ADMIN_TOKEN,
    process.env.TELEGRAM_BOT_TOKEN
  ].filter(Boolean);
}

function hasCleanupAuthorization(request) {
  const tokens = getAuthorizedTokens();

  if (!tokens.length) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization") || "";
  return tokens.some((token) => authHeader === `Bearer ${token}`);
}

function buildUnauthorizedResponse() {
  return NextResponse.json(
    {
      ok: false,
      message: "Demo state cleanup is not authorized"
    },
    { status: 401 }
  );
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

export async function GET(request) {
  if (!hasCleanupAuthorization(request)) {
    return buildUnauthorizedResponse();
  }

  const searchParams = request.nextUrl.searchParams;
  const keepChatIds = searchParams.getAll("keepChatId");
  const keepOrderNumbers = searchParams.getAll("keepOrder");
  const summary = await cleanupDemoState({
    applyChanges: false,
    keepChatIds,
    keepOrderNumbers
  });

  return NextResponse.json({
    ok: true,
    ...summary
  });
}

export async function POST(request) {
  if (!hasCleanupAuthorization(request)) {
    return buildUnauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const keepChatIds = normalizeStringArray(body?.keepChatIds);
  const keepOrderNumbers = normalizeStringArray(body?.keepOrderNumbers);
  const summary = await cleanupDemoState({
    applyChanges: body?.applyChanges !== false,
    keepChatIds,
    keepOrderNumbers
  });

  return NextResponse.json({
    ok: true,
    ...summary
  });
}
