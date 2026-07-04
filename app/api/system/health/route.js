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
import { evaluateSystemHealth } from "../../../../lib/system-health-core.mjs";

export async function GET() {
  const [databaseStatus, env, launchMetrics] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(getEnvironmentPublicSummary()),
    getTelegramLaunchMetrics()
  ]);
  const analytics = getTelegramAnalyticsFoundationStatus();
  const telegram = {
    configured: isTelegramBotConfigured()
  };
  const storage = {
    blobEnabled: isBlobStoreEnabled()
  };
  const ai = getAIServiceStatus();
  const health = evaluateSystemHealth({
    env,
    database: databaseStatus,
    telegram,
    analytics,
    storage,
    ai,
    launchMetrics
  });

  return NextResponse.json({
    ok: health.ok,
    status: health.status,
    mode: health.mode,
    ready: health.ready,
    database: health.database,
    telegram: health.telegram,
    warnings: health.warnings,
    release: "BOSE RC1",
    timestamp: health.timestamp,
    env,
    services: {
      database: health.database,
      telegram: health.telegram,
      analytics,
      storage,
      ai
    },
    launchMetrics
  });
}
