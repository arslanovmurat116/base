import { cookies } from "next/headers";
import { APP_LANGUAGE_COOKIE, DEFAULT_LANGUAGE, isSupportedLanguage } from "./i18n";

export async function getLanguage() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(APP_LANGUAGE_COOKIE)?.value;

  return isSupportedLanguage(cookieValue) ? cookieValue : DEFAULT_LANGUAGE;
}
