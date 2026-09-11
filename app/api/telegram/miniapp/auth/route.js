import { NextResponse } from "next/server";
import { getTelegramBotToken } from "../../../../../lib/telegram";
import {
  buildMiniAppSessionCandidate,
  getMiniAppAuthPlan,
  verifyTelegramMiniAppInitData
} from "../../../../../lib/telegram/miniapp-auth";

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
      maxAgeSeconds: 3600
    });
    const sessionCandidate = buildMiniAppSessionCandidate(verification);
    const launch = verification.verified && sessionCandidate
      ? await recordMiniAppLaunch({
          ...sessionCandidate,
          initDataRaw: body?.initData,
          timestamp: new Date().toISOString(),
          ttlSeconds: 3600,
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

    const ownerAccess = { isOwner: launch?.subject?.role === 'owner' };
    const authToken = session
      ? await createBoseSessionToken({
          sessionId: session.id,
          telegramUserId: sessionCandidate.telegramUserId,
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
      verification: { verified: verification.verified, reason: verification.reason || null },
      sessionCandidate,
      session: session ? { ...session, sessionToken: undefined, initDataHash: undefined, payload: undefined } : null,
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
