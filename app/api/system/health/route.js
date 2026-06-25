import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "../../../../lib/db";
import { getEnvironmentPublicSummary } from "../../../../lib/env";
import { isBlobStoreEnabled } from "../../../../lib/persistent-store";
import { isTelegramBotConfigured } from "../../../../lib/telegram";
import { getAIServiceStatus } from "../../../../lib/ai";
import {
  getTelegramAnalyticsFoundationStatus,
  getTelegramLaunchMetrics
} from "../../../../lib/telegram/analytics";

export async function GET() {
  const [database, env, launchMetrics] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(getEnvironmentPublicSummary()),
    getTelegramLaunchMetrics()
  ]);
  const analytics = getTelegramAnalyticsFoundationStatus();

  return NextResponse.json({
    ok: env.ok && (database.ok || database.mode === "mock"),
    release: "BOSE RC1",
    timestamp: new Date().toISOString(),
    env,
    services: {
      database,
      telegram: {
        configured: isTelegramBotConfigured()
      },
      analytics,
      storage: {
        blobEnabled: isBlobStoreEnabled()
      },
      ai: getAIServiceStatus()
    },
    launchMetrics
  });
}
