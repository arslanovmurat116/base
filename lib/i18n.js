export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = ["en", "ru"];
export const APP_LANGUAGE_COOKIE = "app-lang";

export function isSupportedLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(String(value || "").toLowerCase());
}

export function pick(lang, englishText, russianText) {
  return String(lang) === "ru" ? russianText : englishText;
}

export function getLocale(lang) {
  return String(lang) === "ru" ? "ru-RU" : "en-US";
}
