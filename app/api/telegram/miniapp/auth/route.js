import { NextResponse } from "next/server";
import { getTelegramBotToken } from "../../../../../lib/telegram";
import {
  buildMiniAppSessionCandidate,
  getMiniAppAuthPlan,
  verifyTelegramMiniAppInitData
} from "../../../../../lib/telegram/miniapp-auth";
import { isOwnerIdentity } from "../../../../../lib/owner-access";
import { recordMiniAppLaunch } from "../../../../../lib/telegram/analytics";

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(getTelegramBotToken()),
    plan: getMiniAppAuthPlan()
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const verification = verifyTelegramMiniAppInitData(body?.initData, {
      botToken: getTelegramBotToken(),
      maxAgeSeconds: Number(body?.maxAgeSeconds || 3600)
    });
    const sessionCandidate = buildMiniAppSessionCandidate(verification);
    const launch = verification.verified && sessionCandidate
      ? await recordMiniAppLaunch({
          ...sessionCandidate,
          initDataRaw: body?.initData,
          timestamp: new Date().toISOString(),
          ttlSeconds: Number(body?.ttlSeconds || 3600),
          platform: body?.platform || verification.chatType || "telegram-miniapp",
          device: body?.device || null,
          telegramVersion: body?.telegramVersion || null,
          appVersion: body?.appVersion || "rc1",
          screenPath: body?.screenPath || "/",
          chatId: body?.chatId || null,
          metadata: {
            queryId: verification.queryId || null,
            chatInstance: verification.chatInstance || null,
            canSendAfter: verification.canSendAfter || null
          }
        })
      : null;
    const session = launch?.session || null;

    return NextResponse.json({
      ok: verification.verified,
      verification,
      sessionCandidate,
      session,
      profile: launch?.profile || null,
      subject: launch?.subject || null,
      ownerAccess: {
        isOwner: isOwnerIdentity({
          coreRole: launch?.subject?.role || null,
          subjectRole: launch?.subject?.role || null,
          username: launch?.profile?.username || sessionCandidate?.telegramUsername || null,
          telegramUserId: launch?.profile?.telegramUserId || sessionCandidate?.telegramUserId || null
        })
      },
      analytics: launch?.flags || null
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Mini App auth scaffold failed",
        error: error.message
      },
      { status: 400 }
    );
  }
}
