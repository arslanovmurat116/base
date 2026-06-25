import { NextResponse } from "next/server";
import { trackTelegramAnalyticsEvent } from "../../../../../lib/telegram/analytics";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await trackTelegramAnalyticsEvent({
      ...body,
      timestamp: body?.timestamp || new Date().toISOString()
    });

    return NextResponse.json({
      ok: Boolean(result?.ok),
      result
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Telegram analytics tracking failed",
        error: error.message
      },
      { status: 400 }
    );
  }
}
