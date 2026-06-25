import { NextResponse } from "next/server";
import { endMiniAppSession, trackTelegramAnalyticsEvent } from "../../../../../../lib/telegram/analytics";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await endMiniAppSession({
      ...body,
      endedAt: body?.endedAt || new Date().toISOString()
    });

    if (result?.session?.id) {
      await trackTelegramAnalyticsEvent({
        companyId: body?.companyId,
        profileId: body?.profileId || result.session.profileId,
        sessionId: result.session.id,
        subjectType: body?.subjectType || result.session.subjectType,
        subjectId: body?.subjectId || result.session.subjectId,
        telegramUserId: body?.telegramUserId || result.session.telegramUserId,
        chatId: body?.chatId || result.session.chatId,
        username: body?.username || result.session.telegramUsername,
        languageCode: body?.languageCode || result.session.languageCode,
        platform: body?.platform || result.session.platform,
        appVersion: body?.appVersion || result.session.appVersion,
        timestamp: body?.endedAt || new Date().toISOString(),
        eventName: "session_end",
        eventPayload: {
          durationSeconds: body?.durationSeconds ?? result.session.durationSeconds ?? null,
          screenPath: body?.screenPath || result.session.screenPath || null
        }
      });
    }

    return NextResponse.json({
      ok: Boolean(result?.ok),
      result
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Mini App session end failed",
        error: error.message
      },
      { status: 400 }
    );
  }
}
