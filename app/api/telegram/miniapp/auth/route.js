import { NextResponse } from "next/server";
import { getTelegramBotToken } from "../../../../../lib/telegram";
import {
  buildMiniAppSessionCandidate,
  getMiniAppAuthPlan,
  verifyTelegramMiniAppInitData
} from "../../../../../lib/telegram/miniapp-auth";
import { isOwnerIdentity } from "../../../../../lib/owner-access";
import { recordMiniAppLaunch } from "../../../../../lib/telegram/analytics";
import {
  buildBoseSessionCookie,
  createBoseSessionToken
} from "../../../../../lib/security/session-auth";

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

    const ownerAccess = {
      isOwner: isOwnerIdentity({
        coreRole: launch?.subject?.role || null,
        subjectRole: launch?.subject?.role || null,
        username: launch?.profile?.username || sessionCandidate?.telegramUsername || null,
        telegramUserId: launch?.profile?.telegramUserId || sessionCandidate?.telegramUserId || null
      })
    };
    const authToken = session
      ? await createBoseSessionToken({
          sessionId: session.id,
          companyId: session.companyId || launch?.profile?.companyId || null,
          subjectType: launch?.subject?.subjectType || session.subjectType,
          subjectId: launch?.subject?.subjectId || session.subjectId,
          role: launch?.subject?.role || "client",
          isOwner: ownerAccess.isOwner,
          expiresAt: new Date(session.expiresAt).getTime()
        })
      : null;

    if (verification.verified && session && !authToken) {
      return NextResponse.json(
        { ok: false, message: "Mini App server session could not be issued." },
        { status: 503 }
      );
    }

    const response = NextResponse.json({
      ok: verification.verified,
      verification,
      sessionCandidate,
      session,
      profile: launch?.profile || null,
      subject: launch?.subject || null,
      ownerAccess,
      analytics: launch?.flags || null
    });

    if (authToken) response.cookies.set(buildBoseSessionCookie(authToken, session.expiresAt));
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Mini App auth failed",
        error: error.message
      },
      { status: 400 }
    );
  }
}
