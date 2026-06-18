import { pick } from "./i18n";

export const PROJECT_STATUS_OPTIONS = [
  { value: "draft", en: "Draft", ru: "Черновик" },
  { value: "post-measurement", en: "Post-measurement planning", ru: "После замера собираем проект" },
  { value: "in-progress", en: "Sketch and estimate in progress", ru: "Эскиз и смета в работе" },
  { value: "sent", en: "Sent to client", ru: "Проект отправлен клиенту" },
  { value: "approved", en: "Approved", ru: "Проект согласован" },
  { value: "confirmed", en: "Confirmed", ru: "Проект утверждён" }
];

export const PREPAYMENT_STATUS_OPTIONS = [
  { value: "not-requested", en: "Not requested", ru: "Не запрошена" },
  { value: "requested", en: "Requested", ru: "Запрошена" },
  { value: "waiting", en: "Waiting for deposit", ru: "Ожидаем предоплату" },
  { value: "received", en: "Deposit received", ru: "Предоплата получена" }
];

export const FINAL_PAYMENT_STATUS_OPTIONS = [
  { value: "not-requested", en: "Not requested", ru: "Финальная оплата не запрошена" },
  { value: "waiting", en: "Waiting for final payment", ru: "Ждём окончательную оплату" },
  { value: "paid", en: "Paid in full", ru: "Оплачено полностью" }
];

export const PRODUCTION_STAGE_OPTIONS = [
  { value: "awaiting-cutting", en: "Awaiting cutting", ru: "Ожидает распил" },
  { value: "cutting", en: "Cutting", ru: "Распил" },
  { value: "assembly", en: "Assembly", ru: "Сборка" },
  { value: "ready-for-installation", en: "Ready for installation", ru: "Готово к установке" },
  { value: "installation", en: "Installation", ru: "Установка" },
  { value: "completed", en: "Completed", ru: "Завершено" }
];

export const INSTALLATION_STATUS_OPTIONS = [
  { value: "not-scheduled", en: "Not scheduled", ru: "Не назначена" },
  { value: "ready", en: "Ready for installation", ru: "Готово к монтажу" },
  { value: "in-progress", en: "Installation in progress", ru: "В установке" },
  { value: "completed", en: "Installation completed", ru: "Установка завершена" }
];

export function findStatusOption(options, value) {
  const source = String(value || "").trim().toLowerCase();

  if (!source) {
    return null;
  }

  return (
    options.find(
      (item) =>
        item.value === source ||
        item.en.toLowerCase() === source ||
        item.ru.toLowerCase() === source ||
        item.en.toLowerCase().includes(source) ||
        item.ru.toLowerCase().includes(source) ||
        source.includes(item.en.toLowerCase()) ||
        source.includes(item.ru.toLowerCase())
    ) || null
  );
}

export function normalizeStatusValue(options, value, fallback) {
  return findStatusOption(options, value)?.value || fallback;
}

export function formatStatusValue(options, value, lang, fallback) {
  const option = findStatusOption(options, value);

  if (option) {
    return pick(lang, option.en, option.ru);
  }

  if (value) {
    return String(value);
  }

  return fallback;
}
