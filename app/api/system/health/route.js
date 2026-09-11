import { getBoseSessionFromRequest } from '../../../../lib/security/session-server';
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
import {
  createInternalSystemHealth,
  evaluateSystemHealth,
  getSystemHealthHttpStatus
} from "../../../../lib/system-health-core.mjs";

export async function GET(request) {
  try {
    const session=await getBoseSessionFromRequest(request);
    if(session?.role!=='owner') {
      const database=await checkDatabaseHealth();
      return NextResponse.json({ok:database.ok,status:database.ok?'ok':'unavailable',release:'BOSE security v2'},{status:database.ok?200:503,headers:{'Cache-Control':'no-store'}});
    }
    const [databaseStatus, env, launchMetrics] = await Promise.all([
      checkDatabaseHealth(),
      Promise.resolve(getEnvironmentPublicSummary()),
      getTelegramLaunchMetrics()
    ]);
    const analytics = getTelegramAnalyticsFoundationStatus();
    const storage = {
      blobEnabled: isBlobStoreEnabled()
    };
    const ai = getAIServiceStatus();
    const health = evaluateSystemHealth({
      env,
      database: databaseStatus,
      telegram: {
        configured: isTelegramBotConfigured(),
        appUrlReady: analytics.appUrlReady,
        analyticsEnabled: analytics.enabled
      }
    });

    return NextResponse.json(
      {
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
      },
      {
        status: getSystemHealthHttpStatus(health)
      }
    );
  } catch (error) {
    console.error(
      "System health route failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(createInternalSystemHealth(), {
      status: 500
    });
  }
}
