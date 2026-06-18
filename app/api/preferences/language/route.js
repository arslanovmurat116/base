import { NextResponse } from "next/server";
import { APP_LANGUAGE_COOKIE, DEFAULT_LANGUAGE, isSupportedLanguage } from "../../../../lib/i18n";

export async function POST(request) {
  let lang = DEFAULT_LANGUAGE;

  try {
    const body = await request.json();
    if (isSupportedLanguage(body?.lang)) {
      lang = body.lang;
    }
  } catch {
    lang = DEFAULT_LANGUAGE;
  }

  const response = NextResponse.json({ ok: true, lang });
  response.cookies.set(APP_LANGUAGE_COOKIE, lang, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}
