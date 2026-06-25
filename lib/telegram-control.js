import { buildLeadHref } from "./lead-links";
import {
  completeFollowup,
  createFollowup,
  createTelegramClientLead,
  findTelegramClientLead,
  getAppointmentsData,
  getFollowupsData,
  getLeadsData,
  getWorkboardData,
  updateAppointmentStatus
} from "./server-data";
import {
  answerTelegramCallbackQuery,
  getTelegramBotSecretToken,
  isTelegramBotConfigured,
  sendTelegramBotMessage
} from "./telegram";
import {
  getTelegramRoleLabel as getUnifiedTelegramRoleLabel,
  mapTelegramRoleToCoreRole,
  normalizeTelegramSurfaceRole
} from "./core/roles";
import { readPersistentJson, writePersistentJson } from "./persistent-store";
import {
  deleteTelegramSubscribersByChatIdInDb,
  deleteTelegramRegistrationStateInDb,
  isRuntimeStatePostgresEnabled,
  listTelegramDispatchLogsFromDb,
  listPilotRequestsFromDb,
  listTelegramRegistrationStatesFromDb,
  listTelegramSubscribersFromDb,
  upsertTelegramDispatchLogInDb,
  upsertPilotRequestInDb,
  upsertTelegramRegistrationStateInDb,
  upsertTelegramSubscriberInDb
} from "./runtime-state-db";
import { recordRegistrationCompleted } from "./telegram/analytics";

const TELEGRAM_SUBSCRIBERS_FILE = "telegram-subscribers.json";
const TELEGRAM_DISPATCH_LOG_FILE = "telegram-dispatch-log.json";
const TELEGRAM_REGISTRATION_STATE_FILE = "telegram-registration-state.json";
const TELEGRAM_PILOT_REQUESTS_FILE = "telegram-pilot-requests.json";
const TELEGRAM_BOT_BASE_HREF = "https://t.me/bose_business_os_bot";
const INITIAL_TELEGRAM_SUBSCRIBERS = await readPersistentJson(
  TELEGRAM_SUBSCRIBERS_FILE,
  []
);
const INITIAL_TELEGRAM_DISPATCH_LOG = await readPersistentJson(
  TELEGRAM_DISPATCH_LOG_FILE,
  {}
);
const INITIAL_TELEGRAM_REGISTRATION_STATE = await readPersistentJson(
  TELEGRAM_REGISTRATION_STATE_FILE,
  {}
);
const INITIAL_TELEGRAM_PILOT_REQUESTS = await readPersistentJson(
  TELEGRAM_PILOT_REQUESTS_FILE,
  []
);

const APPOINTMENT_ACTIVE_STATUSES = new Set(["SCHEDULED", "CONFIRMED"]);
const DISPATCH_MODES = new Set(["all", "daily", "control"]);
const ROLE_LABELS = {
  director: "Директор",
  manager: "Менеджер",
  measurer: "Замерщик"
};
const WEEKDAY_INDEX = {
  воскресенье: 0,
  понедельник: 1,
  вторник: 2,
  среда: 3,
  четверг: 4,
  пятница: 5,
  суббота: 6
};

const globalForTelegramControl = globalThis;

function hasNormalizedKeyword(text, variants = []) {
  return variants.some((variant) => text.includes(normalizeLookupText(variant)));
}

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, " ")
    .trim();
}

function getTelegramControlStore() {
  if (!globalForTelegramControl.__mebelTelegramControlStore) {
    globalForTelegramControl.__mebelTelegramControlStore = {
      dispatchLog:
        INITIAL_TELEGRAM_DISPATCH_LOG && typeof INITIAL_TELEGRAM_DISPATCH_LOG === "object"
          ? INITIAL_TELEGRAM_DISPATCH_LOG
          : {},
      registrationState:
        INITIAL_TELEGRAM_REGISTRATION_STATE &&
        typeof INITIAL_TELEGRAM_REGISTRATION_STATE === "object"
          ? INITIAL_TELEGRAM_REGISTRATION_STATE
          : {},
      pilotRequests: Array.isArray(INITIAL_TELEGRAM_PILOT_REQUESTS)
        ? INITIAL_TELEGRAM_PILOT_REQUESTS
        : [],
      subscribers: Array.isArray(INITIAL_TELEGRAM_SUBSCRIBERS)
        ? INITIAL_TELEGRAM_SUBSCRIBERS
        : []
    };
  }

  return globalForTelegramControl.__mebelTelegramControlStore;
}

function normalizeTelegramRole(role) {
  return normalizeTelegramSurfaceRole(role);

  const normalized = normalizeLookupText(role);

  if (["director", "owner", "директор", "собственник"].includes(normalized)) {
    return "director";
  }

  if (["manager", "менеджер"].includes(normalized)) {
    return "manager";
  }

  if (["measurer", "operator", "замерщик"].includes(normalized)) {
    return "measurer";
  }

  return null;
}

function getTelegramRoleLabel(role) {
  return getUnifiedTelegramRoleLabel(role, "ru");

  return ROLE_LABELS[role] || "Не назначена";
}

function normalizeDispatchMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  return DISPATCH_MODES.has(normalized) ? normalized : "all";
}

function getAppBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3004"
  ).replace(/\/+$/, "");
}

function getCompanyId() {
  return process.env.DISET_DEFAULT_COMPANY_ID || null;
}

function buildAbsoluteLeadUrl(slug, section = "summary") {
  const href = buildLeadHref(slug, section);
  return href ? `${getAppBaseUrl()}${href}` : null;
}

function getStoredTelegramSubscribers() {
  const stored = getTelegramControlStore().subscribers;
  return Array.isArray(stored) ? stored : [];
}

async function loadStoredTelegramSubscribers() {
  const companyId = getCompanyId();

  if (isRuntimeStatePostgresEnabled(companyId)) {
    return listTelegramSubscribersFromDb(companyId);
  }

  return readPersistentJson(TELEGRAM_SUBSCRIBERS_FILE, []);
}

async function refreshTelegramSubscriberStore() {
  const nextSubscribers = await loadStoredTelegramSubscribers();
  getTelegramControlStore().subscribers = Array.isArray(nextSubscribers)
    ? nextSubscribers
    : [];
  return getStoredTelegramSubscribers();
}

function getEnvSubscribers() {
  const roleEnvMap = {
    director: process.env.TELEGRAM_DIRECTOR_CHAT_IDS,
    manager: process.env.TELEGRAM_MANAGER_CHAT_IDS,
    measurer: process.env.TELEGRAM_MEASURER_CHAT_IDS
  };

  return Object.entries(roleEnvMap).flatMap(([role, rawChatIds]) =>
    String(rawChatIds || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((chatId) => ({
        chatId,
        role,
        name: null,
        username: null,
        source: "env"
      }))
  );
}

function getTelegramSubscribers() {
  const merged = new Map();

  for (const subscriber of [...getEnvSubscribers(), ...getStoredTelegramSubscribers()]) {
    if (!subscriber?.chatId || !subscriber?.role) {
      continue;
    }

    merged.set(`${subscriber.chatId}:${subscriber.role}`, subscriber);
  }

  return Array.from(merged.values());
}

function getTelegramSubscribersByChatId(chatId) {
  if (!chatId) {
    return [];
  }

  return getTelegramSubscribers().filter((item) => String(item.chatId) === String(chatId));
}

function getPreferredTelegramSubscriber(chatId, preferredRole = null) {
  const subscribers = getTelegramSubscribersByChatId(chatId);

  if (!subscribers.length) {
    return null;
  }

  if (preferredRole) {
    const preferred = subscribers.find((item) => item.role === preferredRole);

    if (preferred) {
      return preferred;
    }
  }

  return subscribers[0] || null;
}

async function upsertTelegramSubscriber(subscriber) {
  const companyId = getCompanyId();
  const current = getStoredTelegramSubscribers();
  const next = current.filter(
    (item) =>
      !(String(item.chatId) === String(subscriber.chatId) && item.role === subscriber.role)
  );

  const nextSubscriber = {
    ...subscriber,
    registeredAt: subscriber.registeredAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };

  if (isRuntimeStatePostgresEnabled(companyId)) {
    const persistedSubscriber =
      (await upsertTelegramSubscriberInDb(companyId, nextSubscriber)) || nextSubscriber;
    next.push(persistedSubscriber);
    getTelegramControlStore().subscribers = next;
    return persistedSubscriber;
  }

  next.push(nextSubscriber);

  getTelegramControlStore().subscribers = next;
  await writePersistentJson(TELEGRAM_SUBSCRIBERS_FILE, next);
  return nextSubscriber;
}

async function removeStoredTelegramSubscribersByChatId(chatId) {
  if (!chatId) {
    return;
  }

  const companyId = getCompanyId();

  const current = getStoredTelegramSubscribers();
  const next = current.filter((item) => String(item.chatId) !== String(chatId));

  if (next.length === current.length) {
    return;
  }

  if (isRuntimeStatePostgresEnabled(companyId)) {
    await deleteTelegramSubscribersByChatIdInDb(companyId, chatId);
    getTelegramControlStore().subscribers = next;
    return;
  }

  getTelegramControlStore().subscribers = next;
  await writePersistentJson(TELEGRAM_SUBSCRIBERS_FILE, next);
}

function getTelegramDispatchLog() {
  const stored = getTelegramControlStore().dispatchLog;
  return stored && typeof stored === "object" ? stored : {};
}

async function loadStoredTelegramDispatchLog() {
  const companyId = getCompanyId();

  if (isRuntimeStatePostgresEnabled(companyId)) {
    const rows = await listTelegramDispatchLogsFromDb(companyId);
    return Object.fromEntries(
      rows.filter((item) => item?.key && item?.sentAt).map((item) => [item.key, item.sentAt])
    );
  }

  return readPersistentJson(TELEGRAM_DISPATCH_LOG_FILE, {});
}

async function refreshTelegramDispatchLogStore() {
  const nextLog = await loadStoredTelegramDispatchLog();
  getTelegramControlStore().dispatchLog =
    nextLog && typeof nextLog === "object" ? nextLog : {};
  return getTelegramDispatchLog();
}

function getTelegramPilotRequests() {
  const stored = getTelegramControlStore().pilotRequests;
  return Array.isArray(stored) ? stored : [];
}

async function loadStoredTelegramPilotRequests() {
  const companyId = getCompanyId();

  if (isRuntimeStatePostgresEnabled(companyId)) {
    return listPilotRequestsFromDb(companyId);
  }

  return readPersistentJson(TELEGRAM_PILOT_REQUESTS_FILE, []);
}

async function refreshTelegramPilotRequestStore() {
  const nextRequests = await loadStoredTelegramPilotRequests();
  getTelegramControlStore().pilotRequests = Array.isArray(nextRequests) ? nextRequests : [];
  return getTelegramPilotRequests();
}

async function persistTelegramPilotRequest(request) {
  const companyId = getCompanyId();
  const current = await refreshTelegramPilotRequestStore();

  if (isRuntimeStatePostgresEnabled(companyId)) {
    const persistedRequest = await upsertPilotRequestInDb(companyId, request);
    const finalRequest = persistedRequest || request;
    const next = [
      finalRequest,
      ...current.filter(
        (item) =>
          String(item?.id || "") !== String(finalRequest.id || "") &&
          String(item?.requestNumber || "") !== String(finalRequest.requestNumber || "")
      )
    ];
    getTelegramControlStore().pilotRequests = next;
    return finalRequest;
  }

  const next = [...current, request];
  getTelegramControlStore().pilotRequests = next;
  await writePersistentJson(TELEGRAM_PILOT_REQUESTS_FILE, next);
  return request;
}

function getTelegramRegistrationState() {
  const stored = getTelegramControlStore().registrationState;
  return stored && typeof stored === "object" ? stored : {};
}

async function loadStoredTelegramRegistrationState() {
  const companyId = getCompanyId();

  if (isRuntimeStatePostgresEnabled(companyId)) {
    const rows = await listTelegramRegistrationStatesFromDb(companyId);
    return Object.fromEntries(
      rows
        .filter((item) => item?.chatId)
        .map((item) => [String(item.chatId), item.payload || {}])
    );
  }

  return readPersistentJson(TELEGRAM_REGISTRATION_STATE_FILE, {});
}

async function refreshTelegramRegistrationStateStore() {
  const nextState = await loadStoredTelegramRegistrationState();
  getTelegramControlStore().registrationState =
    nextState && typeof nextState === "object" ? nextState : {};
  return getTelegramRegistrationState();
}

async function writeTelegramRegistrationState(nextState) {
  getTelegramControlStore().registrationState = nextState;
  await writePersistentJson(TELEGRAM_REGISTRATION_STATE_FILE, nextState);
}

function readPendingRegistration(chatId) {
  if (!chatId) {
    return null;
  }

  return getTelegramRegistrationState()[String(chatId)] || null;
}

async function writePendingRegistration(chatId, payload) {
  if (!chatId) {
    return;
  }

  const nextEntry = {
    ...payload,
    updatedAt: new Date().toISOString()
  };
  const companyId = getCompanyId();

  if (isRuntimeStatePostgresEnabled(companyId)) {
    await upsertTelegramRegistrationStateInDb(companyId, chatId, nextEntry);
    const nextState = getTelegramRegistrationState();
    nextState[String(chatId)] = nextEntry;
    getTelegramControlStore().registrationState = nextState;
    return;
  }

  const nextState = getTelegramRegistrationState();
  nextState[String(chatId)] = nextEntry;
  await writeTelegramRegistrationState(nextState);
}

async function clearPendingRegistration(chatId) {
  if (!chatId) {
    return;
  }

  const nextState = getTelegramRegistrationState();
  delete nextState[String(chatId)];
  const companyId = getCompanyId();

  if (isRuntimeStatePostgresEnabled(companyId)) {
    await deleteTelegramRegistrationStateInDb(companyId, chatId);
    getTelegramControlStore().registrationState = nextState;
    return;
  }

  await writeTelegramRegistrationState(nextState);
}

function canSendDispatchKey(key, ttlHours) {
  if (!key) {
    return true;
  }

  const lastSentAt = getTelegramDispatchLog()[key];

  if (!lastSentAt) {
    return true;
  }

  const lastTime = new Date(lastSentAt).getTime();
  return Number.isNaN(lastTime) || Date.now() - lastTime > ttlHours * 60 * 60 * 1000;
}

async function markDispatchKeySent(key) {
  if (!key) {
    return;
  }

  const log = getTelegramDispatchLog();
  const sentAt = new Date().toISOString();
  log[key] = sentAt;
  getTelegramControlStore().dispatchLog = log;
  const companyId = getCompanyId();

  if (isRuntimeStatePostgresEnabled(companyId)) {
    await upsertTelegramDispatchLogInDb(companyId, key, sentAt);
    return;
  }

  await writePersistentJson(TELEGRAM_DISPATCH_LOG_FILE, log);
}

function getTelegramCommandThrottleKey(chatId, command) {
  if (!chatId || !command) {
    return null;
  }

  return `command:${String(chatId)}:${String(command).trim().toLowerCase()}`;
}

function canRunTelegramCommand(chatId, command, ttlSeconds = 20) {
  const key = getTelegramCommandThrottleKey(chatId, command);

  if (!key) {
    return true;
  }

  const lastRunAt = getTelegramDispatchLog()[key];

  if (!lastRunAt) {
    return true;
  }

  const lastTime = new Date(lastRunAt).getTime();
  return Number.isNaN(lastTime) || Date.now() - lastTime > ttlSeconds * 1000;
}

async function markTelegramCommandRun(chatId, command) {
  const key = getTelegramCommandThrottleKey(chatId, command);

  if (!key) {
    return;
  }

  await markDispatchKeySent(key);
}

function parseBusinessDate(value, isoValue = null) {
  if (isoValue) {
    const isoDate = new Date(isoValue);

    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }

  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const directDate = new Date(raw);

  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const lower = raw.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
  const now = new Date();
  const base = new Date(now);
  const hours = timeMatch ? Number(timeMatch[1]) : 9;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;

  base.setSeconds(0, 0);
  base.setHours(hours, minutes, 0, 0);

  if (lower.includes("сегодня")) {
    return base;
  }

  if (lower.includes("завтра")) {
    base.setDate(base.getDate() + 1);
    return base;
  }

  if (lower.includes("вчера")) {
    base.setDate(base.getDate() - 1);
    return base;
  }

  for (const [weekdayName, weekdayIndex] of Object.entries(WEEKDAY_INDEX)) {
    if (!lower.includes(weekdayName)) {
      continue;
    }

    const diff = (weekdayIndex - now.getDay() + 7) % 7;
    const useNextWeek = diff === 0 && base.getTime() < now.getTime();
    base.setDate(base.getDate() + diff + (useNextWeek ? 7 : 0));
    return base;
  }

  return null;
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isTomorrowDay(left, right) {
  const tomorrow = new Date(right);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(left, tomorrow);
}

function formatDispatchDate(date, fallbackText) {
  if (!date || Number.isNaN(date.getTime())) {
    return fallbackText || "Время уточняется";
  }

  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function matchesSubscriberOwner(ownerName, subscriber) {
  if (!subscriber?.name) {
    return true;
  }

  const normalizedOwner = normalizeLookupText(ownerName);
  const normalizedSubscriber = normalizeLookupText(subscriber.name);

  return (
    !normalizedOwner ||
    normalizedOwner === normalizedSubscriber ||
    normalizedOwner.includes(normalizedSubscriber) ||
    normalizedSubscriber.includes(normalizedOwner)
  );
}

function buildInlineKeyboard(rows) {
  if (!rows.length) {
    return undefined;
  }

  return {
    inline_keyboard: rows
  };
}

function buildRegistrationRoleKeyboard() {
  return buildInlineKeyboard([
    [
      {
        text: "Директор",
        callback_data: "reg|role|director"
      },
      {
        text: "Менеджер",
        callback_data: "reg|role|manager"
      }
    ],
    [
      {
        text: "Замерщик",
        callback_data: "reg|role|measurer"
      }
    ]
  ]);
}

function buildOpenDealButton(slug, section = "summary", label = "Открыть сделку") {
  const url = buildAbsoluteLeadUrl(slug, section);

  if (!url) {
    return null;
  }

  return {
    text: label,
    url
  };
}

function buildOpenRouteButton(path, label) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`;
  const baseUrl = getAppBaseUrl();

  if (!baseUrl) {
    return null;
  }

  return {
    text: label,
    url: `${baseUrl}${normalizedPath}`
  };
}

function buildOpenBotStartButton(startPayload, label) {
  const normalizedPayload = String(startPayload || "").trim().toLowerCase();

  if (!normalizedPayload) {
    return null;
  }

  return {
    text: label,
    url: `${TELEGRAM_BOT_BASE_HREF}?start=${encodeURIComponent(normalizedPayload)}`
  };
}

function buildOpenAppButton(label = "Открыть CRM") {
  const appUrl = getAppBaseUrl();

  if (/^https:\/\//i.test(appUrl)) {
    return {
      text: label,
      web_app: {
        url: appUrl
      }
    };
  }

  return {
    text: label,
    url: appUrl
  };
}

function withAppAccessReplyMarkup(replyMarkup, label = "Открыть CRM") {
  const appButton = buildOpenAppButton(label);
  const appTargetUrl = appButton?.url || appButton?.web_app?.url || null;

  if (!appTargetUrl) {
    return replyMarkup;
  }

  const currentRows = Array.isArray(replyMarkup?.inline_keyboard)
    ? replyMarkup.inline_keyboard
    : [];
  const hasAppButton = currentRows.some((row) =>
    Array.isArray(row) &&
    row.some((button) => {
      const buttonTargetUrl = button?.url || button?.web_app?.url || null;
      return buttonTargetUrl === appTargetUrl;
    })
  );

  if (hasAppButton) {
    return replyMarkup;
  }

  return buildInlineKeyboard([...currentRows, [appButton]]);
}

async function deliverTelegramMessage(chatId, text, options = {}) {
  const replyMarkup = withAppAccessReplyMarkup(options.replyMarkup, options.appButtonLabel);
  const payload = {
    text,
    replyMarkup: replyMarkup || null
  };

  if (options.forcePreview || !isTelegramBotConfigured()) {
    return {
      ok: true,
      mode: "preview",
      chatId: String(chatId),
      payload
    };
  }

  try {
    const result = await sendTelegramBotMessage(chatId, text, {
      disable_web_page_preview: true,
      reply_markup: replyMarkup || undefined
    });

    return {
      ok: true,
      mode: "sent",
      chatId: String(chatId),
      messageId: result.message_id,
      payload
    };
  } catch (error) {
    const errorMessage = error?.message || "Telegram send failed";

    if (/chat not found/iu.test(errorMessage)) {
      await removeStoredTelegramSubscribersByChatId(chatId);
    }

    return {
      ok: false,
      mode: "send_error",
      chatId: String(chatId),
      message: errorMessage,
      payload
    };
  }
}

async function acknowledgeTelegramCallback(callbackQueryId, text) {
  if (!callbackQueryId) {
    return;
  }

  if (!isTelegramBotConfigured()) {
    return;
  }

  try {
    await answerTelegramCallbackQuery(callbackQueryId, text, {
      show_alert: false
    });
  } catch (error) {
    console.warn("Telegram callback acknowledge failed:", error.message);
  }
}

async function collectTelegramControlData() {
  const [leads, followups, appointments, workboard] = await Promise.all([
    getLeadsData(),
    getFollowupsData(),
    getAppointmentsData(),
    getWorkboardData("owner")
  ]);
  const now = new Date();

  const pendingFollowups = followups
    .filter((item) => String(item.status || "PENDING") === "PENDING")
    .map((item) => ({
      ...item,
      dueDate: parseBusinessDate(item.scheduledAt, item.scheduledAtIso)
    }));

  const overdueFollowups = pendingFollowups.filter(
    (item) => item.dueDate && item.dueDate.getTime() <= now.getTime()
  );
  const dueSoonFollowups = pendingFollowups.filter((item) => {
    if (!item.dueDate) {
      return false;
    }

    const diffMs = item.dueDate.getTime() - now.getTime();
    return diffMs > 0 && diffMs <= 3 * 60 * 60 * 1000;
  });

  const activeAppointments = appointments
    .filter((item) => APPOINTMENT_ACTIVE_STATUSES.has(String(item.status || "")))
    .map((item) => ({
      ...item,
      appointmentDate: parseBusinessDate(item.scheduledAt, item.scheduledAtIso)
    }));

  const todayAppointments = activeAppointments.filter(
    (item) => item.appointmentDate && isSameDay(item.appointmentDate, now)
  );
  const soonAppointments = activeAppointments.filter((item) => {
    if (!item.appointmentDate) {
      return false;
    }

    const diffMs = item.appointmentDate.getTime() - now.getTime();
    return diffMs >= 0 && diffMs <= 2 * 60 * 60 * 1000;
  });

  return {
    now,
    leads,
    followups: pendingFollowups,
    overdueFollowups,
    dueSoonFollowups,
    appointments,
    activeAppointments,
    todayAppointments,
    soonAppointments,
    workboard,
    urgentLeads: Array.isArray(workboard?.urgentLeads) ? workboard.urgentLeads : [],
    alerts: Array.isArray(workboard?.alerts) ? workboard.alerts : []
  };
}

function buildDirectorDigest(data, subscriber) {
  const lines = [
    `Контроль цеха на ${data.now.toLocaleDateString("ru-RU")}`,
    "",
    `Новые заявки в NEW: ${data.leads.filter((item) => item.status === "NEW").length}`,
    `Просроченные возвраты: ${data.overdueFollowups.length}`,
    `Активные замеры и встречи: ${data.activeAppointments.length}`,
    `Замеры на сегодня: ${data.todayAppointments.length}`,
    `Контрольные сигналы: ${(data.workboard.alerts || []).length}`
  ];

  const spotlight = [
    ...data.overdueFollowups.slice(0, 2).map(
      (item) =>
        `• ${item.lead} — просрочен ${item.type.toLowerCase()} (${formatDispatchDate(
          item.dueDate,
          item.scheduledAt
        )})`
    ),
    ...data.todayAppointments.slice(0, 2).map(
      (item) =>
        `• ${item.lead} — ${item.typeLabel || item.type} ${formatDispatchDate(
          item.appointmentDate,
          item.scheduledAt
        )}`
    )
  ];

  if (spotlight.length) {
    lines.push("", "Фокус на сейчас:", ...spotlight);
  }

  return {
    key: `director-daily:${data.now.toISOString().slice(0, 10)}:${subscriber.chatId}`,
    ttlHours: 18,
    text: lines.join("\n")
  };
}

function buildManagerDigest(data, subscriber) {
  const ownFollowups = data.followups.filter((item) => matchesSubscriberOwner(item.owner, subscriber));
  const ownTodayAppointments = data.todayAppointments.filter((item) =>
    matchesSubscriberOwner(item.owner || item.measurer, subscriber)
  );
  const ownOverdueFollowups = data.overdueFollowups.filter((item) =>
    matchesSubscriberOwner(item.owner, subscriber)
  );

  const lines = [
    `Смена менеджера${subscriber?.name ? `: ${subscriber.name}` : ""}`,
    "",
    `Следующих контактов в работе: ${ownFollowups.length}`,
    `Просрочено возвратов: ${ownOverdueFollowups.length}`,
    `Замеров и встреч на сегодня: ${ownTodayAppointments.length}`,
    `Сделок без ответа в NEW: ${data.leads.filter((item) => item.status === "NEW").length}`
  ];

  const nearest = [
    ...ownOverdueFollowups.slice(0, 2).map(
      (item) =>
        `• ${item.lead} — ${item.type} (${formatDispatchDate(item.dueDate, item.scheduledAt)})`
    ),
    ...ownTodayAppointments.slice(0, 2).map(
      (item) =>
        `• ${item.lead} — ${item.typeLabel || item.type} (${formatDispatchDate(
          item.appointmentDate,
          item.scheduledAt
        )})`
    )
  ];

  if (nearest.length) {
    lines.push("", "Ближайшие действия:", ...nearest);
  }

  return {
    key: `manager-daily:${data.now.toISOString().slice(0, 10)}:${subscriber.chatId}:${normalizeLookupText(
      subscriber.name
    )}`,
    ttlHours: 12,
    text: lines.join("\n")
  };
}

function buildMeasurerDigest(data, subscriber) {
  const ownAppointments = data.todayAppointments.filter((item) =>
    matchesSubscriberOwner(item.owner || item.measurer, subscriber)
  );

  const lines = [
    `План замерщика${subscriber?.name ? `: ${subscriber.name}` : ""}`,
    "",
    `Выездов и встреч на сегодня: ${ownAppointments.length}`,
    `Подтверждённых слотов: ${
      ownAppointments.filter((item) => String(item.status) === "CONFIRMED").length
    }`
  ];

  if (ownAppointments.length) {
    lines.push(
      "",
      ...ownAppointments.slice(0, 4).map(
        (item) =>
          `• ${item.lead} — ${formatDispatchDate(item.appointmentDate, item.scheduledAt)}, ${
            item.address || item.location
          }`
      )
    );
  }

  return {
    key: `measurer-daily:${data.now.toISOString().slice(0, 10)}:${subscriber.chatId}:${normalizeLookupText(
      subscriber.name
    )}`,
    ttlHours: 12,
    text: lines.join("\n")
  };
}

function buildFollowupActionMessage(item, subscriber, now, variant = "overdue") {
  const openDealButton = buildOpenDealButton(item.slug, "followups");
  const dateKey = item.dueDate ? item.dueDate.toISOString().slice(0, 13) : now.toISOString().slice(0, 13);
  const rows = [
    [
      {
        text: "Сделано",
        callback_data: `fu|done|${item.slug}|${item.typeKey || "custom"}`
      }
    ]
  ];

  if (openDealButton) {
    rows.push([openDealButton]);
  }

  return {
    key: `followup:${variant}:${item.slug}:${item.typeKey || "custom"}:${subscriber.chatId}:${dateKey}`,
    ttlHours: 4,
    text: [
      variant === "soon" ? "Скоро следующий контакт" : "Просрочен следующий контакт",
      `${item.lead}`,
      `${item.type}`,
      `Когда: ${formatDispatchDate(item.dueDate, item.scheduledAt)}`,
      item.note ? `Комментарий: ${item.note}` : null
    ]
      .filter(Boolean)
      .join("\n"),
    replyMarkup: buildInlineKeyboard(rows)
  };
}

function buildAppointmentActionMessage(item, subscriber, now, variant = "today") {
  const openDealButton = buildOpenDealButton(item.slug, "measurements");
  const rows = [
    [
      {
        text: "Подтверждено",
        callback_data: `ap|CONFIRMED|${item.id}`
      },
      {
        text: "Не состоялось",
        callback_data: `ap|NO_SHOW|${item.id}`
      }
    ]
  ];

  if (subscriber.role === "measurer") {
    rows.push([
      {
        text: "Завершено",
        callback_data: `ap|COMPLETED|${item.id}`
      }
    ]);
  }

  if (openDealButton) {
    rows.push([openDealButton]);
  }

  return {
    key: `appointment:${variant}:${item.id}:${subscriber.chatId}:${now.toISOString().slice(0, 13)}`,
    ttlHours: 4,
    text: [
      variant === "soon" ? "Скоро замер или встреча" : "Контроль замера или встречи",
      `${item.lead}`,
      `${item.typeLabel || item.type}`,
      `Когда: ${formatDispatchDate(item.appointmentDate, item.scheduledAt)}`,
      item.address || item.location ? `Адрес: ${item.address || item.location}` : null,
      item.note ? `Комментарий: ${item.note}` : null
    ]
      .filter(Boolean)
      .join("\n"),
    replyMarkup: buildInlineKeyboard(rows)
  };
}

function buildLeadAttentionMessage(item, subscriber, now) {
  const openDealButton = buildOpenDealButton(item.slug, "workflow");
  const rows = openDealButton ? [[openDealButton]] : [];

  return {
    key: `lead-attention:${item.slug}:${subscriber.chatId}:${now.toISOString().slice(0, 13)}`,
    ttlHours: 3,
    text: [
      "Сделка требует внимания",
      `${item.lead}`,
      item.tag ? `Контекст: ${item.tag}` : null,
      item.deadline ? `Срок: ${item.deadline}` : null,
      item.owner ? `Ответственный: ${item.owner}` : null,
      item.status ? `Статус: ${item.status}` : null
    ]
      .filter(Boolean)
      .join("\n"),
    replyMarkup: buildInlineKeyboard(rows)
  };
}

function buildDirectorControlMessage(data, subscriber) {
  const overdue = data.overdueFollowups.slice(0, 2);
  const alerts = data.alerts.slice(0, 3);
  const todayAppointments = data.todayAppointments.slice(0, 2);

  if (!overdue.length && !alerts.length && !todayAppointments.length) {
    return null;
  }

  const lines = [
    "Контрольный пульс цеха",
    `Просроченных возвратов: ${data.overdueFollowups.length}`,
    `Сигналов в workboard: ${data.alerts.length}`,
    `Активных замеров на сегодня: ${data.todayAppointments.length}`
  ];

  const spotlight = [
    ...overdue.map(
      (item) =>
        `• Возврат: ${item.lead} — ${item.type} (${formatDispatchDate(item.dueDate, item.scheduledAt)})`
    ),
    ...todayAppointments.map(
      (item) =>
        `• Замер: ${item.lead} — ${item.typeLabel || item.type} (${formatDispatchDate(
          item.appointmentDate,
          item.scheduledAt
        )})`
    ),
    ...alerts.map(
      (item) =>
        `• Сигнал: ${item.lead} — ${item.action}${item.detail ? `. ${item.detail}` : ""}`
    )
  ];

  const buttons = alerts
    .filter((item) => item.slug)
    .slice(0, 3)
    .map((item) => [buildOpenDealButton(item.slug, "history", `Открыть ${item.lead}`)])
    .filter((row) => row[0]);

  if (spotlight.length) {
    lines.push("", "Фокус на сейчас:", ...spotlight);
  }

  return {
    key: `director-control:${data.now.toISOString().slice(0, 13)}:${subscriber.chatId}`,
    ttlHours: 2,
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(buttons)
  };
}

function buildDispatchMessagesForSubscriber(data, subscriber, mode = "all") {
  const dispatchMode = normalizeDispatchMode(mode);
  const messages = [];

  if (subscriber.role === "director") {
    if (dispatchMode !== "control") {
      messages.push(buildDirectorDigest(data, subscriber));
    }

    if (dispatchMode !== "daily") {
      const controlMessage = buildDirectorControlMessage(data, subscriber);

      if (controlMessage) {
        messages.push(controlMessage);
      }
    }

    return messages;
  }

  if (subscriber.role === "manager") {
    if (dispatchMode !== "control") {
      messages.push(buildManagerDigest(data, subscriber));
    }

    if (dispatchMode === "daily") {
      return messages;
    }

    const followups = data.overdueFollowups
      .filter((item) => matchesSubscriberOwner(item.owner, subscriber))
      .slice(0, 2);
    const dueSoonFollowups = data.dueSoonFollowups
      .filter((item) => matchesSubscriberOwner(item.owner, subscriber))
      .slice(0, 2);
    const appointments = data.soonAppointments
      .filter((item) => matchesSubscriberOwner(item.owner || item.measurer, subscriber))
      .slice(0, 2);
    const urgentLeads = data.urgentLeads
      .filter((item) => matchesSubscriberOwner(item.owner, subscriber))
      .slice(0, 2);

    for (const item of followups) {
      messages.push(buildFollowupActionMessage(item, subscriber, data.now, "overdue"));
    }

    for (const item of dueSoonFollowups) {
      messages.push(buildFollowupActionMessage(item, subscriber, data.now, "soon"));
    }

    for (const item of appointments) {
      messages.push(buildAppointmentActionMessage(item, subscriber, data.now, "soon"));
    }

    for (const item of urgentLeads) {
      messages.push(buildLeadAttentionMessage(item, subscriber, data.now));
    }

    return messages;
  }

  if (subscriber.role === "measurer") {
    if (dispatchMode !== "control") {
      messages.push(buildMeasurerDigest(data, subscriber));
    }

    if (dispatchMode === "daily") {
      return messages;
    }

    const appointments = data.soonAppointments
      .filter((item) => matchesSubscriberOwner(item.owner || item.measurer, subscriber))
      .slice(0, 3);

    for (const item of appointments) {
      messages.push(buildAppointmentActionMessage(item, subscriber, data.now, "soon"));
    }
  }

  return messages;
}

export async function getTelegramControlStatus() {
  await refreshTelegramSubscriberStore();

  return {
    configured: isTelegramBotConfigured(),
    webhookSecretConfigured: Boolean(getTelegramBotSecretToken()),
    subscribers: getTelegramSubscribers().map((item) => ({
      chatId: item.chatId,
      role: item.role,
      coreRole: mapTelegramRoleToCoreRole(item.role),
      roleLabel: getTelegramRoleLabel(item.role),
      name: item.name || null,
      source: item.source || "mock-store"
    }))
  };
}

export async function runTelegramDispatch(options = {}) {
  await refreshTelegramSubscriberStore();

  const dryRun = options.dryRun !== false;
  const force = options.force === true;
  const mode = normalizeDispatchMode(options.mode);
  const roleFilter = normalizeTelegramRole(options.role) || null;
  const chatIdFilter = options.chatId ? String(options.chatId) : null;
  const data = await collectTelegramControlData();
  const subscribers = getTelegramSubscribers().filter((subscriber) => {
    if (roleFilter && subscriber.role !== roleFilter) {
      return false;
    }

    if (chatIdFilter && String(subscriber.chatId) !== chatIdFilter) {
      return false;
    }

    return true;
  });

  if (!subscribers.length) {
    return {
      ok: true,
      dryRun: true,
      force,
      mode,
      message: "Нет зарегистрированных Telegram-чатов. Используйте /register в боте.",
      summary: {
        subscribers: 0,
        sent: 0,
        preview: 0,
        skipped: 0
      },
      deliveries: []
    };
  }

  const deliveries = [];

  for (const subscriber of subscribers) {
    const messages = buildDispatchMessagesForSubscriber(data, subscriber, mode);

    for (const message of messages) {
      if (!dryRun && !force && !canSendDispatchKey(message.key, message.ttlHours || 4)) {
        deliveries.push({
          chatId: String(subscriber.chatId),
          role: subscriber.role,
          key: message.key,
          skipped: true,
          reason: "already_sent_recently"
        });
        continue;
      }

      const delivery = await deliverTelegramMessage(
        subscriber.chatId,
        message.text,
        {
          replyMarkup: message.replyMarkup,
          forcePreview: dryRun
        }
      );

      if (!dryRun && delivery.mode === "sent") {
        await markDispatchKeySent(message.key);
      }

      deliveries.push({
        ...delivery,
        role: subscriber.role,
        key: message.key
      });
    }
  }

  return {
    ok: true,
    dryRun,
    force,
    mode,
    summary: {
      subscribers: subscribers.length,
      sent: deliveries.filter((item) => item.mode === "sent").length,
      preview: deliveries.filter((item) => item.mode === "preview").length,
      skipped: deliveries.filter((item) => item.skipped).length
    },
    deliveries
  };
}

export function resolveTelegramDispatchScope(scope) {
  const normalized = String(scope || "daily")
    .trim()
    .toLowerCase();

  const scopeMap = {
    daily: { mode: "daily", role: null },
    control: { mode: "control", role: null },
    "director-daily": { mode: "daily", role: "director" },
    "manager-daily": { mode: "daily", role: "manager" },
    "measurer-daily": { mode: "daily", role: "measurer" },
    "director-control": { mode: "control", role: "director" },
    "manager-control": { mode: "control", role: "manager" },
    "measurer-control": { mode: "control", role: "measurer" }
  };

  return scopeMap[normalized] || null;
}

export async function runTelegramDispatchScope(scope, options = {}) {
  const resolvedScope = resolveTelegramDispatchScope(scope);

  if (!resolvedScope) {
    return {
      ok: false,
      status: 400,
      message: "Неизвестный scope Telegram dispatch"
    };
  }

  return runTelegramDispatch({
    dryRun: options.dryRun,
    force: options.force,
    mode: resolvedScope.mode,
    role: resolvedScope.role,
    chatId: options.chatId || null
  });
}

function buildHelpText(subscriber) {
  return [
    "Бот контроля мебельного цеха",
    "",
    subscriber
      ? `Текущая роль: ${getTelegramRoleLabel(subscriber.role)}${subscriber.name ? ` (${subscriber.name})` : ""}`
      : "Чат ещё не привязан к роли.",
    "",
    "Команды:",
    "/register директор Имя",
    "/register менеджер Имя",
    "/register замерщик Имя",
    "/status",
    "/today",
    "/control",
    "/alerts",
    "/appointments",
    "/demo",
    "/pilot",
    "",
    "Для менеджера можно и без команды:",
    "• сегодня / замер / выезд",
    "• позвонить / клиенты / кого",
    "• срочно / возвраты / расчёт",
    "• предоплата / оплата / производство"
  ].join("\n");
}

function buildClientMenuKeyboard(lead = null) {
  const rows = [
    [
      {
        text: "Оставить заявку",
        callback_data: "cl|request"
      },
      {
        text: "Статус заказа",
        callback_data: "cl|status"
      }
    ],
    [
      {
        text: "Подтвердить замер",
        callback_data: "cl|confirm"
      },
      {
        text: "Получить расчёт",
        callback_data: "cl|estimate"
      }
    ],
    [
      {
        text: "Перейти к предоплате",
        callback_data: "cl|deposit"
      },
      {
        text: "Связаться с менеджером",
        callback_data: "cl|manager"
      }
    ],
    [
      {
        text: "Как это работает",
        callback_data: "cl|demo"
      }
    ]
  ];

  if (lead?.slug) {
    const openOrderButton = buildOpenDealButton(lead.slug, "summary", "Открыть заказ");

    if (openOrderButton) {
      rows.push([openOrderButton]);
    }
  }

  return buildInlineKeyboard(rows);
}

function buildClientHelpText(lead = null) {
  return [
    "BOSE — Telegram-first business OS with the Furneq module",
    "",
    lead?.slug
      ? `Ваш заказ найден: ${lead.name}${lead.orderNumber ? ` (${lead.orderNumber})` : ""}`
      : "Здесь можно оставить заявку, узнать статус заказа, подтвердить замер и запросить расчёт.",
    "",
    "Что можно сделать прямо здесь:",
    "• оставить заявку",
    "• посмотреть статус заказа",
    "• подтвердить замер",
    "• получить расчёт",
    "• перейти к предоплате",
    "• связаться с менеджером",
    "",
    "Нажми кнопку ниже или просто напиши: заявка, статус, замер, расчёт, предоплата."
  ].join("\n");
}

function buildSalesDemoLeadRows() {
  return [
    [buildOpenDealButton("l-201", "summary", "Новая заявка")],
    [buildOpenDealButton("l-202", "estimate", "Расчёт и проект")],
    [buildOpenDealButton("l-206", "production", "Предоплата и производство")]
  ].filter((row) => row.every(Boolean));
}

function buildClientDemoText() {
  return [
    "Как показывать BOSE в демо:",
    "",
    "1. Клиент оставляет заявку в Telegram.",
    "2. CRM сразу создаёт карточку сделки.",
    "3. Менеджер видит новый заказ в workboard.",
    "4. Цех двигает заказ к замеру, расчёту и предоплате.",
    "",
    "Для живого показа можно сразу нажать «Оставить заявку» и пройти короткий сценарий."
  ].join("\n");
}

function buildClientDemoReplyMarkup(lead = null) {
  const rows = [];
  const sampleDealButton = buildOpenDealButton("l-202", "summary", "Открыть пример сделки");
  const workboardButton = buildOpenRouteButton("/workboard", "Открыть смену");
  const appointmentsButton = buildOpenRouteButton("/appointments", "Открыть замеры");

  if (sampleDealButton) {
    rows.push([sampleDealButton]);
  }

  if (workboardButton) {
    rows.push([workboardButton]);
  }

  if (appointmentsButton) {
    rows.push([appointmentsButton]);
  }

  const menuRows = buildClientMenuKeyboard(lead)?.inline_keyboard || [];
  return buildInlineKeyboard([...menuRows, ...rows]);
}

function buildClientDemoTextV2() {
  return [
    "Как показывать BOSE в демо:",
    "",
    "1. РљР»РёРµРЅС‚ РѕСЃС‚Р°РІР»СЏРµС‚ Р·Р°СЏРІРєСѓ РІ Telegram.",
    "2. CRM СЃСЂР°Р·Сѓ СЃРѕР·РґР°С‘С‚ РєР°СЂС‚РѕС‡РєСѓ СЃРґРµР»РєРё.",
    "3. РњРµРЅРµРґР¶РµСЂ РІРёРґРёС‚ РЅРѕРІС‹Р№ Р·Р°РєР°Р· РІ workboard.",
    "4. Р¦РµС… РґРІРёРіР°РµС‚ Р·Р°РєР°Р· Рє Р·Р°РјРµСЂСѓ, СЂР°СЃС‡С‘С‚Сѓ Рё РїСЂРµРґРѕРїР»Р°С‚Рµ.",
    "",
    "Р”Р»СЏ РїРѕРєР°Р·Р° РѕС‚РєСЂРѕР№ С‚СЂРё СЃРѕСЃС‚РѕСЏРЅРёСЏ: РЅРѕРІР°СЏ Р·Р°СЏРІРєР°, СЂР°СЃС‡С‘С‚ Рё РїСЂРѕРёР·РІРѕРґСЃС‚РІРѕ."
  ].join("\n");
}

function buildClientDemoReplyMarkupV2(lead = null) {
  const rows = [
    [buildOpenDealButton("l-201", "summary", "РќРѕРІР°СЏ Р·Р°СЏРІРєР°")],
    [buildOpenDealButton("l-202", "estimate", "Р Р°СЃС‡С‘С‚ Рё РїСЂРѕРµРєС‚")],
    [buildOpenDealButton("l-206", "production", "РџСЂРµРґРѕРїР»Р°С‚Р° Рё РїСЂРѕРёР·РІРѕРґСЃС‚РІРѕ")]
  ].filter((row) => row.every(Boolean));
  const workboardButton = buildOpenRouteButton("/workboard", "РћС‚РєСЂС‹С‚СЊ СЃРјРµРЅСѓ");
  const appointmentsButton = buildOpenRouteButton("/appointments", "РћС‚РєСЂС‹С‚СЊ Р·Р°РјРµСЂС‹");
  const pilotButton = buildOpenBotStartButton("pilot", "Запросить запуск пилота");

  if (workboardButton) {
    rows.push([workboardButton]);
  }

  if (appointmentsButton) {
    rows.push([appointmentsButton]);
  }

  if (pilotButton) {
    rows.push([pilotButton]);
  }

  const menuRows = buildClientMenuKeyboard(lead)?.inline_keyboard || [];
  return buildInlineKeyboard([...menuRows, ...rows]);
}

function normalizeTelegramStartPayload(rawPayload) {
  const normalized = normalizeLookupText(rawPayload);

  if (!normalized) {
    return null;
  }

  const directMap = {
    demo: "demo",
    request: "request",
    pilot: "pilot",
    status: "status",
    estimate: "estimate",
    deposit: "deposit",
    manager: "manager",
    app: "app"
  };

  if (directMap[normalized]) {
    return directMap[normalized];
  }

  return resolveClientTextIntent(normalized);
}

function buildClientLeadActionRows(lead, options = {}) {
  if (!lead?.slug) {
    return [];
  }

  const rows = [];
  const preferredRows = [
    buildOpenDealButton(lead.slug, options.primarySection || "summary", options.primaryLabel || "Открыть заказ"),
    buildOpenDealButton(lead.slug, "measurements", "Открыть замер"),
    buildOpenDealButton(lead.slug, "estimate", "Открыть расчёт"),
    buildOpenDealButton(lead.slug, "production", "Открыть оплату и производство")
  ].filter(Boolean);

  for (const button of preferredRows.slice(0, 4)) {
    rows.push([button]);
  }

  return rows;
}

function buildLeadLinkRows(items = [], resolveSection) {
  return items
    .filter((item) => item?.slug)
    .slice(0, 4)
    .map((item) => {
      const button = buildOpenDealButton(
        item.slug,
        typeof resolveSection === "function" ? resolveSection(item) : "summary",
        item.lead || item.name || "Открыть сделку"
      );

      return button ? [button] : null;
    })
    .filter(Boolean);
}

function getScopedItems(items = [], predicate, { allowFallback = true } = {}) {
  const scopedItems = items.filter((item) => predicate(item));

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: [...items],
    scopedToSubscriber: false
  };
}

function resolveManagerTaskSection(item) {
  const text = normalizeLookupText(item?.title, item?.tag, item?.lane, item?.note, item?.lead);

  if (
    hasNormalizedKeyword(text, [
      "расч",
      "расчет",
      "смет",
      "кп",
      "бюджет",
      "стоимост",
      "цен"
    ])
  ) {
    return "estimate";
  }

  if (
    hasNormalizedKeyword(text, ["замер", "выезд", "шоурум", "консультац", "встреч"])
  ) {
    return "measurements";
  }

  if (
    hasNormalizedKeyword(text, [
      "предоплат",
      "производ",
      "распил",
      "сборк",
      "монтаж",
      "установ"
    ])
  ) {
    return "production";
  }

  if (hasNormalizedKeyword(text, ["возврат", "дожим", "согласован", "созвон", "контакт"])) {
    return "followups";
  }

  return "workflow";
}

function resolvePaymentLeadSection(item) {
  const text = normalizeLookupText(item?.dealStage, item?.productionStatus, item?.status);

  if (
    String(item?.status || "") === "WON" ||
    hasNormalizedKeyword(text, ["производ", "распил", "сборк", "установ", "монтаж"])
  ) {
    return "production";
  }

  return "followups";
}

function buildLeadNamesMap(leads = []) {
  return new Map(leads.map((item) => [item.slug, item.lead || item.name || item.slug]));
}

function getPaymentAmountLabel(item) {
  return item?.prepaymentAmount || item?.finalAmount || item?.estimateRange || item?.budget || "Сумма уточняется";
}

function getPaymentStatusLabel(item) {
  return item?.prepaymentStatus || item?.finalPaymentStatus || item?.dealStage || "Контроль оплаты";
}

function isPaymentReceivedText(text) {
  return (
    hasNormalizedKeyword(text, ["получ", "внес", "оплачен", "оплачена", "оплачено"]) &&
    !hasNormalizedKeyword(text, ["ожида", "ждем", "ждём"])
  );
}

function isAwaitingAnyPayment(item) {
  const text = normalizeLookupText(
    item?.prepaymentStatus,
    item?.finalPaymentStatus,
    item?.dealStage,
    item?.status
  );

  return (
    hasNormalizedKeyword(text, ["предоплат", "аванс", "оплат", "остаток", "платеж"]) &&
    !isPaymentReceivedText(text)
  );
}

function isAwaitingPrepayment(item) {
  const text = normalizeLookupText(item?.prepaymentStatus, item?.dealStage, item?.status);
  return hasNormalizedKeyword(text, ["предоплат", "аванс"]) && !isPaymentReceivedText(text);
}

function hasPaymentSignalText(...values) {
  const text = normalizeLookupText(...values);
  return hasNormalizedKeyword(text, ["предоплат", "аванс", "оплат", "остаток", "платеж"]);
}

function getManagerTodayAppointments(data, subscriber, { allowFallback = true } = {}) {
  const ownTodayAppointments = data.todayAppointments
    .filter((item) => matchesSubscriberOwner(item.owner || item.measurer, subscriber))
    .sort((left, right) => {
      const leftTime = left.appointmentDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
      const rightTime = right.appointmentDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });

  if (ownTodayAppointments.length || !allowFallback) {
    return {
      items: ownTodayAppointments,
      scopedToSubscriber: ownTodayAppointments.length > 0
    };
  }

  const allTodayAppointments = [...data.todayAppointments].sort((left, right) => {
    const leftTime = left.appointmentDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
    const rightTime = right.appointmentDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });

  return {
    items: allTodayAppointments,
    scopedToSubscriber: false
  };
}

function resolveConsultationLeadSection(item) {
  switch (String(item?.status || "")) {
    case "QUALIFIED":
      return "estimate";
    case "MEETING":
      return "measurements";
    case "PROPOSAL":
      return "followups";
    default:
      return "workflow";
  }
}

function buildManagerAppointmentsTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerTodayAppointments(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "На сегодня в CRM нет активных замеров и консультаций."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `На сегодня у вас ${items.length} замер(а) или консультации:`
      : `На сегодня в CRM ${items.length} замер(а) или консультации:`,
    "",
    ...visible.map(
      (item, index) =>
        `${index + 1}. ${item.lead} — ${item.typeLabel || item.type}, ${formatDispatchDate(
          item.appointmentDate,
          item.scheduledAt
        )}`
    )
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в /appointments.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(buildLeadLinkRows(visible, () => "measurements"))
  };
}

function buildManagerConsultationCandidates(data, subscriber) {
  const candidates = [];
  const seen = new Set();
  const activeAppointmentSlugs = new Set(
    data.activeAppointments
      .filter((item) => matchesSubscriberOwner(item.owner || item.measurer, subscriber))
      .map((item) => item.slug)
      .filter(Boolean)
  );

  const pushCandidate = (candidate) => {
    if (!candidate?.slug || seen.has(candidate.slug)) {
      return;
    }

    seen.add(candidate.slug);
    candidates.push(candidate);
  };

  for (const item of data.overdueFollowups.filter((entry) =>
    matchesSubscriberOwner(entry.owner, subscriber)
  )) {
    pushCandidate({
      slug: item.slug,
      lead: item.lead,
      status: "CONTACTED",
      reason: `Просрочен контакт: ${String(item.type || "возврат").toLowerCase()}`,
      at: item.dueDate?.getTime?.() || Date.now(),
      section: "followups"
    });
  }

  for (const item of data.dueSoonFollowups.filter((entry) =>
    matchesSubscriberOwner(entry.owner, subscriber)
  )) {
    pushCandidate({
      slug: item.slug,
      lead: item.lead,
      status: "CONTACTED",
      reason: `Ближайший контакт: ${String(item.type || "возврат").toLowerCase()}`,
      at: item.dueDate?.getTime?.() || Date.now(),
      section: "followups"
    });
  }

  for (const item of data.urgentLeads.filter((entry) =>
    matchesSubscriberOwner(entry.owner, subscriber)
  )) {
    pushCandidate({
      slug: item.slug,
      lead: item.lead,
      status: item.status || "NEW",
      reason: item.action || "Сделка требует внимания менеджера",
      at: Date.now(),
      section: resolveConsultationLeadSection(item)
    });
  }

  for (const item of data.leads.filter((entry) =>
    matchesSubscriberOwner(entry.manager, subscriber)
  )) {
    if (activeAppointmentSlugs.has(item.slug)) {
      continue;
    }

    if (!["NEW", "CONTACTED", "QUALIFIED"].includes(String(item.status || ""))) {
      continue;
    }

    const reasonByStatus = {
      NEW: "Новая заявка, нужен первый контакт",
      CONTACTED: "Нужен следующий созвон или консультация",
      QUALIFIED: "Нужен расчёт или согласование консультации"
    };

    pushCandidate({
      slug: item.slug,
      lead: item.name || item.lead,
      status: item.status,
      reason: reasonByStatus[item.status] || "Нужен контакт менеджера",
      at: item.nextContactAt ? parseBusinessDate(item.nextContactAt)?.getTime?.() || Date.now() : Date.now(),
      section: resolveConsultationLeadSection(item)
    });
  }

  return candidates.sort((left, right) => left.at - right.at);
}

function getManagerConsultationCandidates(data, subscriber, { allowFallback = true } = {}) {
  const scopedCandidates = buildManagerConsultationCandidates(data, subscriber);

  if (scopedCandidates.length || !allowFallback) {
    return {
      items: scopedCandidates,
      scopedToSubscriber: scopedCandidates.length > 0
    };
  }

  return {
    items: buildManagerConsultationCandidates(data, { role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerConsultationTextMessage(data, subscriber) {
  const { items: candidates, scopedToSubscriber } = getManagerConsultationCandidates(
    data,
    subscriber,
    { allowFallback: true }
  );

  if (!candidates.length) {
    return {
      text: "Сейчас в CRM нет клиентов, которым срочно нужен контакт или консультация."
    };
  }

  const visible = candidates.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `Сейчас в первую очередь стоит связаться с ${candidates.length} клиент(ом/ами):`
      : `Сейчас по CRM в первую очередь стоит связаться с ${candidates.length} клиент(ом/ами):`,
    "",
    ...visible.map((item, index) => `${index + 1}. ${item.lead} — ${item.reason}`)
  ];

  if (candidates.length > visible.length) {
    lines.push("", `Ещё ${candidates.length - visible.length} смотрите в /control и /alerts.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(visible, (item) => item.section || resolveConsultationLeadSection(item))
    )
  };
}

function buildManagerUrgentTextMessage(data, subscriber) {
  const taskQueue = Array.isArray(data.workboard?.taskQueue) ? data.workboard.taskQueue : [];
  const { items, scopedToSubscriber } = getScopedItems(
    taskQueue,
    (item) => matchesSubscriberOwner(item.owner, subscriber),
    { allowFallback: true }
  );

  if (!items.length) {
    return {
      text: "Сейчас в CRM нет срочных задач для менеджера."
    };
  }

  const leadNamesBySlug = new Map(
    data.leads.map((item) => [item.slug, item.lead || item.name || item.slug])
  );
  const visible = items.slice(0, 4);
  const linkItems = visible.map((item) => ({
    ...item,
    lead: leadNamesBySlug.get(item.slug) || item.lead || item.title || "Открыть сделку"
  }));
  const lines = [
    scopedToSubscriber
      ? `Срочное на сейчас: ${items.length} задач(и) по вашим сделкам.`
      : `Срочное на сейчас по CRM: ${items.length} задач(и).`,
    "",
    ...visible.map(
      (item, index) =>
        `${index + 1}. ${item.title}${item.deadline ? ` — ${item.deadline}` : ""}`
    )
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в /control.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(linkItems, (item) => resolveManagerTaskSection(item))
    )
  };
}

function getManagerFollowupFocusItems(data, subscriber, { allowFallback = true } = {}) {
  const collectItems = (targetSubscriber) => {
    const scopedOverdue = data.overdueFollowups.filter((item) =>
      matchesSubscriberOwner(item.owner, targetSubscriber)
    );
    const scopedDueSoon = data.dueSoonFollowups.filter((item) =>
      matchesSubscriberOwner(item.owner, targetSubscriber)
    );
    const seen = new Set();
    const merged = [];

    for (const item of [...scopedOverdue, ...scopedDueSoon]) {
      const key = `${item.slug || "lead"}:${item.typeKey || item.type || item.id || "followup"}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(item);
    }

    return merged.sort((left, right) => {
      const leftTime = left.dueDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
      const rightTime = right.dueDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  };

  const scopedItems = collectItems(subscriber);

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: collectItems({ role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerFollowupTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerFollowupFocusItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "Сейчас в CRM нет просроченных возвратов и дожима."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `Возвраты и дожим в фокусе: ${items.length} пункт(а) по вашим сделкам.`
      : `Возвраты и дожим по CRM: ${items.length} пункт(а).`,
    "",
    ...visible.map(
      (item, index) =>
        `${index + 1}. ${item.lead} — ${item.type}, ${formatDispatchDate(
          item.dueDate,
          item.scheduledAt
        )}`
    )
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в /alerts.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(buildLeadLinkRows(visible, () => "followups"))
  };
}

function getManagerEstimateItems(data, subscriber, { allowFallback = true } = {}) {
  const estimatePredicate = (item) => {
    const text = normalizeLookupText(item?.dealStage, item?.calculationStatus, item?.status);
    return (
      hasNormalizedKeyword(text, ["расч", "расчет", "смет", "кп", "бюджет"]) ||
      ["QUALIFIED", "PROPOSAL"].includes(String(item?.status || ""))
    );
  };

  return getScopedItems(
    data.leads.filter((item) => estimatePredicate(item)),
    (item) => matchesSubscriberOwner(item.manager, subscriber),
    { allowFallback }
  );
}

function buildManagerEstimateTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerEstimateItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "Сейчас в CRM нет сделок, где нужен расчёт или смета."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `По расчётам и сметам у вас ${items.length} сделок(и):`
      : `По расчётам и сметам в CRM ${items.length} сделок(и):`,
    "",
    ...visible.map((item, index) => {
      const amount = item.finalAmount || item.estimateRange || item.budget || "Сумма уточняется";
      return `${index + 1}. ${item.lead || item.name} — ${item.calculationStatus}. ${amount}`;
    })
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в /leads.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(buildLeadLinkRows(visible, () => "estimate"))
  };
}

function getManagerPaymentItems(data, subscriber, { allowFallback = true } = {}) {
  const paymentPredicate = (item) => {
    const statusText = normalizeLookupText(
      item?.prepaymentStatus,
      item?.dealStage,
      item?.productionStatus,
      item?.status
    );

    return (
      String(item?.prepaymentAmount || "").trim() !== "" ||
      hasNormalizedKeyword(statusText, ["предоплат", "аванс", "оплат", "остаток", "платеж"]) ||
      ["PROPOSAL", "WON"].includes(String(item?.status || ""))
    );
  };

  return getScopedItems(
    data.leads.filter((item) => paymentPredicate(item)),
    (item) => matchesSubscriberOwner(item.manager, subscriber),
    { allowFallback }
  );
}

function buildManagerPaymentsTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerPaymentItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "Сейчас в CRM нет сделок, где нужно контролировать оплату или предоплату."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `По оплатам у вас ${items.length} сделок(и):`
      : `По оплатам в CRM ${items.length} сделок(и):`,
    "",
    ...visible.map((item, index) => {
      const amount = item.prepaymentAmount || item.finalAmount || "Сумма уточняется";
      return `${index + 1}. ${item.lead || item.name} — ${item.prepaymentStatus}. ${amount}`;
    })
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в /leads.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(visible, (item) => resolvePaymentLeadSection(item))
    )
  };
}

function getManagerTomorrowPaymentItems(data, subscriber, { allowFallback = true } = {}) {
  const now = data.now;
  const leadNamesBySlug = buildLeadNamesMap(data.leads);
  const taskQueue = Array.isArray(data.workboard?.taskQueue) ? data.workboard.taskQueue : [];

  const collectItems = (targetSubscriber) => {
    const items = [];
    const seen = new Set();
    const pushItem = (candidate) => {
      const dedupeKey = [
        candidate?.slug || "",
        candidate?.title || "",
        candidate?.fallbackText || "",
        candidate?.section || ""
      ].join("|");

      if (!candidate?.slug || seen.has(dedupeKey)) {
        return;
      }

      seen.add(dedupeKey);
      items.push(candidate);
    };

    for (const lead of data.leads.filter((item) => matchesSubscriberOwner(item.manager, targetSubscriber))) {
      const dueDate = parseBusinessDate(lead.nextContactAt) || parseBusinessDate(lead.deadline);

      if (!dueDate || !isTomorrowDay(dueDate, now) || !isAwaitingAnyPayment(lead)) {
        continue;
      }

      pushItem({
        slug: lead.slug,
        lead: lead.lead || lead.name,
        title: getPaymentStatusLabel(lead),
        amount: getPaymentAmountLabel(lead),
        when: dueDate,
        fallbackText: lead.nextContactAt || lead.deadline,
        section: resolvePaymentLeadSection(lead)
      });
    }

    for (const followup of data.followups.filter((item) => {
      return (
        item.dueDate &&
        isTomorrowDay(item.dueDate, now) &&
        matchesSubscriberOwner(item.owner, targetSubscriber) &&
        hasPaymentSignalText(item.type, item.note)
      );
    })) {
      pushItem({
        slug: followup.slug,
        lead: followup.lead,
        title: followup.type,
        when: followup.dueDate,
        fallbackText: followup.scheduledAt,
        section: "followups"
      });
    }

    for (const task of taskQueue) {
      const deadlineDate = parseBusinessDate(task.deadline);

      if (
        !deadlineDate ||
        !isTomorrowDay(deadlineDate, now) ||
        !matchesSubscriberOwner(task.owner, targetSubscriber) ||
        !hasPaymentSignalText(task.title, task.note, task.tag, task.lane)
      ) {
        continue;
      }

      pushItem({
        slug: task.slug,
        lead: leadNamesBySlug.get(task.slug) || task.lead || task.title,
        title: task.title,
        when: deadlineDate,
        fallbackText: task.deadline,
        section: "followups"
      });
    }

    return items.sort((left, right) => {
      const leftTime = left.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      const rightTime = right.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  };

  const scopedItems = collectItems(subscriber);

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: collectItems({ role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerTomorrowPaymentsTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerTomorrowPaymentItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "На завтра в CRM нет сделок, где нужно отдельно контролировать оплату или предоплату."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `На завтра по оплатам у вас ${items.length} пункт(а):`
      : `На завтра по оплатам в CRM ${items.length} пункт(а):`,
    "",
    ...visible.map((item, index) => {
      const amountPart = item.amount ? `. ${item.amount}` : "";
      return `${index + 1}. ${item.lead} — ${item.title}${amountPart}, ${formatDispatchDate(
        item.when,
        item.fallbackText
      )}`;
    })
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в карточках сделок.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(visible, (item) => item.section || resolvePaymentLeadSection(item))
    )
  };
}

function getManagerPrepaymentPushItems(data, subscriber, { allowFallback = true } = {}) {
  const collectItems = (targetSubscriber) => {
    const items = [];
    const seen = new Set();
    const paymentFollowups = [...data.overdueFollowups, ...data.followups]
      .filter(
        (item) =>
          matchesSubscriberOwner(item.owner, targetSubscriber) &&
          hasPaymentSignalText(item.type, item.note)
      )
      .sort((left, right) => {
        const leftTime = left.dueDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
        const rightTime = right.dueDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime;
      });
    const followupBySlug = new Map();
    const overdueSlugs = new Set(data.overdueFollowups.map((item) => item.slug).filter(Boolean));

    for (const followup of paymentFollowups) {
      if (followup?.slug && !followupBySlug.has(followup.slug)) {
        followupBySlug.set(followup.slug, followup);
      }
    }

    for (const lead of data.leads.filter((item) => matchesSubscriberOwner(item.manager, targetSubscriber))) {
      if (!lead?.slug || !isAwaitingPrepayment(lead) || seen.has(lead.slug)) {
        continue;
      }

      seen.add(lead.slug);

      const relatedFollowup = followupBySlug.get(lead.slug) || null;
      const when =
        relatedFollowup?.dueDate ||
        parseBusinessDate(lead.nextContactAt) ||
        parseBusinessDate(lead.deadline);
      const fallbackText =
        relatedFollowup?.scheduledAt || lead.nextContactAt || lead.deadline || null;

      items.push({
        slug: lead.slug,
        lead: lead.lead || lead.name,
        title:
          relatedFollowup?.type ||
          lead.nextStep ||
          lead.prepaymentStatus ||
          "Нужно довести до предоплаты",
        amount: getPaymentAmountLabel(lead),
        when,
        fallbackText,
        section: "followups",
        overdue: overdueSlugs.has(lead.slug)
      });
    }

    return items.sort((left, right) => {
      if (left.overdue !== right.overdue) {
        return left.overdue ? -1 : 1;
      }

      const leftTime = left.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      const rightTime = right.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  };

  const scopedItems = collectItems(subscriber);

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: collectItems({ role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerPrepaymentPushTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerPrepaymentPushItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "Сейчас в CRM нет сделок, которые нужно отдельно дожимать до предоплаты."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `До предоплаты нужно дожать ${items.length} сделок(и) по вашим клиентам:`
      : `До предоплаты нужно дожать ${items.length} сделок(и) по CRM:`,
    "",
    ...visible.map((item, index) => {
      const amountPart = item.amount ? `. ${item.amount}` : "";
      const whenPart =
        item.when || item.fallbackText
          ? `, ${formatDispatchDate(item.when, item.fallbackText)}`
          : "";
      return `${index + 1}. ${item.lead} — ${item.title}${amountPart}${whenPart}`;
    })
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в follow-up по сделкам.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(buildLeadLinkRows(visible, () => "followups"))
  };
}

function getManagerStuckAfterEstimateItems(data, subscriber, { allowFallback = true } = {}) {
  const collectItems = (targetSubscriber) => {
    const items = [];
    const seen = new Set();
    const estimateFollowups = [...data.overdueFollowups, ...data.followups]
      .filter(
        (item) =>
          matchesSubscriberOwner(item.owner, targetSubscriber) &&
          hasNormalizedKeyword(
            normalizeLookupText(item.type, item.note),
            ["кп", "смет", "расч", "согласован", "коммерчес"]
          )
      )
      .sort((left, right) => {
        const leftTime = left.dueDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
        const rightTime = right.dueDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime;
      });
    const followupBySlug = new Map();
    const overdueSlugs = new Set(data.overdueFollowups.map((item) => item.slug).filter(Boolean));

    for (const followup of estimateFollowups) {
      if (followup?.slug && !followupBySlug.has(followup.slug)) {
        followupBySlug.set(followup.slug, followup);
      }
    }

    for (const lead of data.leads.filter((item) => matchesSubscriberOwner(item.manager, targetSubscriber))) {
      if (!lead?.slug || seen.has(lead.slug)) {
        continue;
      }

      const estimateSignal = normalizeLookupText(
        lead.calculationStatus,
        lead.nextStep,
        lead.dealStage,
        lead.commentary
      );
      const relatedFollowup = followupBySlug.get(lead.slug) || null;

      if (
        !relatedFollowup &&
        !hasNormalizedKeyword(estimateSignal, ["кп", "смет", "согласован", "расч"])
      ) {
        continue;
      }

      if (isPaymentReceivedText(normalizeLookupText(lead.prepaymentStatus, lead.finalPaymentStatus))) {
        continue;
      }

      seen.add(lead.slug);

      items.push({
        slug: lead.slug,
        lead: lead.lead || lead.name,
        title:
          relatedFollowup?.type ||
          lead.calculationStatus ||
          lead.nextStep ||
          "Нужно вернуться после КП",
        when:
          relatedFollowup?.dueDate ||
          parseBusinessDate(lead.nextContactAt) ||
          parseBusinessDate(lead.deadline),
        fallbackText: relatedFollowup?.scheduledAt || lead.nextContactAt || lead.deadline,
        section: relatedFollowup ? "followups" : "estimate",
        overdue: overdueSlugs.has(lead.slug)
      });
    }

    return items.sort((left, right) => {
      if (left.overdue !== right.overdue) {
        return left.overdue ? -1 : 1;
      }

      const leftTime = left.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      const rightTime = right.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  };

  const scopedItems = collectItems(subscriber);

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: collectItems({ role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerStuckAfterEstimateTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerStuckAfterEstimateItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "Сейчас в CRM нет сделок, которые зависли после КП или сметы."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `После КП зависло ${items.length} сделок(и) по вашим клиентам:`
      : `После КП зависло ${items.length} сделок(и) по CRM:`,
    "",
    ...visible.map((item, index) => {
      const whenPart =
        item.when || item.fallbackText
          ? `, ${formatDispatchDate(item.when, item.fallbackText)}`
          : "";
      return `${index + 1}. ${item.lead} — ${item.title}${whenPart}`;
    })
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в CRM.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(visible, (item) => item.section || "estimate")
    )
  };
}

function getManagerPaymentsTodayItems(data, subscriber, { allowFallback = true } = {}) {
  const now = data.now;
  const collectItems = (targetSubscriber) => {
    const items = [];
    const seen = new Set();
    const pushItem = (candidate) => {
      const dedupeKey = [
        candidate?.slug || "",
        candidate?.title || "",
        candidate?.fallbackText || "",
        candidate?.section || ""
      ].join("|");

      if (!candidate?.slug || seen.has(dedupeKey)) {
        return;
      }

      seen.add(dedupeKey);
      items.push(candidate);
    };

    for (const followup of [...data.overdueFollowups, ...data.followups]) {
      if (
        !followup?.slug ||
        !followup.dueDate ||
        !isSameDay(followup.dueDate, now) ||
        !matchesSubscriberOwner(followup.owner, targetSubscriber) ||
        !hasPaymentSignalText(followup.type, followup.note)
      ) {
        continue;
      }

      pushItem({
        slug: followup.slug,
        lead: followup.lead,
        title: followup.type,
        when: followup.dueDate,
        fallbackText: followup.scheduledAt,
        section: "followups"
      });
    }

    for (const alert of data.alerts.filter(
      (item) =>
        matchesSubscriberOwner(item.owner, targetSubscriber) &&
        hasPaymentSignalText(item.action, item.detail)
    )) {
      pushItem({
        slug: alert.slug,
        lead: alert.lead,
        title: alert.action,
        when: null,
        fallbackText: null,
        section: resolvePaymentLeadSection(alert)
      });
    }

    return items.slice(0, 6);
  };

  const scopedItems = collectItems(subscriber);

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: collectItems({ role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerPaymentsTodayTextMessage(data, subscriber) {
  const paymentScope = getManagerPaymentItems(data, subscriber, { allowFallback: true });
  const todayScope = getManagerPaymentsTodayItems(data, subscriber, { allowFallback: true });
  const prepaymentWaitingCount = paymentScope.items.filter((item) =>
    normalizeLookupText(item.prepaymentStatus).includes("ожида")
  ).length;
  const prepaymentReceivedCount = paymentScope.items.filter((item) =>
    normalizeLookupText(item.prepaymentStatus).includes("получ")
  ).length;

  if (!todayScope.items.length && !paymentScope.items.length) {
    return {
      text: "Сегодня в CRM нет отдельных сигналов по оплатам."
    };
  }

  const visible = todayScope.items.slice(0, 4);
  const lines = [
    todayScope.scopedToSubscriber || paymentScope.scopedToSubscriber
      ? "Сегодня по оплатам у вас такой срез:"
      : "Сегодня по оплатам в CRM такой срез:",
    "",
    `Ждут предоплату: ${prepaymentWaitingCount}`,
    `Предоплата получена: ${prepaymentReceivedCount}`
  ];

  if (visible.length) {
    lines.push(
      "",
      "Точки контроля на сегодня:",
      ...visible.map((item, index) => {
        const whenPart =
          item.when || item.fallbackText
            ? `, ${formatDispatchDate(item.when, item.fallbackText)}`
            : "";
        return `${index + 1}. ${item.lead} — ${item.title}${whenPart}`;
      })
    );
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(visible.length ? visible : paymentScope.items.slice(0, 4), (item) =>
        item.section || resolvePaymentLeadSection(item)
      )
    )
  };
}

function getManagerQuotesTodayItems(data, subscriber, { allowFallback = true } = {}) {
  const now = data.now;
  const collectItems = (targetSubscriber) => {
    const items = [];
    const seen = new Set();
    const pushItem = (candidate) => {
      const dedupeKey = [
        candidate?.slug || "",
        candidate?.title || "",
        candidate?.fallbackText || "",
        candidate?.section || ""
      ].join("|");

      if (!candidate?.slug || seen.has(dedupeKey)) {
        return;
      }

      seen.add(dedupeKey);
      items.push(candidate);
    };

    for (const followup of [...data.overdueFollowups, ...data.followups]) {
      if (
        !followup?.slug ||
        !followup.dueDate ||
        !isSameDay(followup.dueDate, now) ||
        !matchesSubscriberOwner(followup.owner, targetSubscriber) ||
        !hasNormalizedKeyword(normalizeLookupText(followup.type, followup.note), [
          "кп",
          "смет",
          "расч",
          "коммерчес"
        ])
      ) {
        continue;
      }

      pushItem({
        slug: followup.slug,
        lead: followup.lead,
        title: followup.type,
        when: followup.dueDate,
        fallbackText: followup.scheduledAt,
        section: "estimate"
      });
    }

    for (const alert of data.alerts.filter(
      (item) =>
        matchesSubscriberOwner(item.owner, targetSubscriber) &&
        hasNormalizedKeyword(normalizeLookupText(item.action, item.detail), [
          "кп",
          "смет",
          "расч",
          "коммерчес"
        ])
    )) {
      pushItem({
        slug: alert.slug,
        lead: alert.lead,
        title: alert.action,
        when: null,
        fallbackText: null,
        section: "estimate"
      });
    }

    return items.slice(0, 6);
  };

  const scopedItems = collectItems(subscriber);

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: collectItems({ role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerQuotesTodayTextMessage(data, subscriber) {
  const estimateScope = getManagerEstimateItems(data, subscriber, { allowFallback: true });
  const todayScope = getManagerQuotesTodayItems(data, subscriber, { allowFallback: true });
  const visibleEstimateItems = estimateScope.items.slice(0, 3);
  const visibleTodayItems = todayScope.items.slice(0, 4);

  if (!todayScope.items.length && !estimateScope.items.length) {
    return {
      text: "Сегодня в CRM нет отдельных сигналов по КП и сметам."
    };
  }

  const lines = [
    todayScope.scopedToSubscriber || estimateScope.scopedToSubscriber
      ? "Сегодня по КП и сметам у вас такой срез:"
      : "Сегодня по КП и сметам в CRM такой срез:",
    "",
    `КП и сметы в работе: ${estimateScope.items.length}`
  ];

  if (visibleTodayItems.length) {
    lines.push(
      "",
      "Точки контроля на сегодня:",
      ...visibleTodayItems.map((item, index) => {
        const whenPart =
          item.when || item.fallbackText
            ? `, ${formatDispatchDate(item.when, item.fallbackText)}`
            : "";
        return `${index + 1}. ${item.lead} — ${item.title}${whenPart}`;
      })
    );
  } else if (visibleEstimateItems.length) {
    lines.push(
      "",
      "Фокус по расчётам:",
      ...visibleEstimateItems.map(
        (item, index) =>
          `${index + 1}. ${item.lead || item.name} — ${item.calculationStatus || item.dealStage}`
      )
    );
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(
        visibleTodayItems.length ? visibleTodayItems : visibleEstimateItems,
        (item) => item.section || "estimate"
      )
    )
  };
}

function buildManagerCloseTodayCandidates(data, subscriber) {
  const activeAppointmentSlugs = new Set(data.activeAppointments.map((item) => item.slug).filter(Boolean));
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (candidate) => {
    if (!candidate?.slug || seen.has(candidate.slug)) {
      return;
    }

    seen.add(candidate.slug);
    candidates.push(candidate);
  };

  for (const item of data.overdueFollowups.filter((entry) => matchesSubscriberOwner(entry.owner, subscriber))) {
    pushCandidate({
      slug: item.slug,
      lead: item.lead,
      reason: `Просрочен ${String(item.type || "следующий шаг").toLowerCase()}`,
      at: item.dueDate?.getTime?.() || Date.now(),
      section: "followups"
    });
  }

  for (const item of data.followups.filter((entry) =>
    matchesSubscriberOwner(entry.owner, subscriber)
  )) {
    if (!item.dueDate || !isSameDay(item.dueDate, data.now)) {
      continue;
    }

    pushCandidate({
      slug: item.slug,
      lead: item.lead,
      reason: item.type || "Следующий шаг на сегодня",
      at: item.dueDate?.getTime?.() || Date.now(),
      section: "followups"
    });
  }

  for (const item of data.leads.filter((entry) => matchesSubscriberOwner(entry.manager, subscriber))) {
    if (activeAppointmentSlugs.has(item.slug)) {
      continue;
    }

    const dueDate = parseBusinessDate(item.nextContactAt) || parseBusinessDate(item.deadline);
    const status = String(item.status || "");

    if (dueDate && isSameDay(dueDate, data.now) && ["NEW", "CONTACTED", "QUALIFIED"].includes(status)) {
      const reasonByStatus = {
        NEW: "Закрыть первый контакт сегодня",
        CONTACTED: "Закрыть следующий созвон сегодня",
        QUALIFIED: "Закрыть расчёт или согласование сегодня"
      };

      pushCandidate({
        slug: item.slug,
        lead: item.lead || item.name,
        reason: reasonByStatus[status] || "Закрыть шаг сегодня",
        at: dueDate.getTime(),
        section: resolveConsultationLeadSection(item)
      });
    }

    if (isAwaitingPrepayment(item) && dueDate && isSameDay(dueDate, data.now)) {
      pushCandidate({
        slug: item.slug,
        lead: item.lead || item.name,
        reason: "Довести до предоплаты сегодня",
        at: dueDate.getTime(),
        section: "followups"
      });
    }
  }

  return candidates.sort((left, right) => left.at - right.at);
}

function getManagerCloseTodayItems(data, subscriber, { allowFallback = true } = {}) {
  const scopedItems = buildManagerCloseTodayCandidates(data, subscriber);

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: buildManagerCloseTodayCandidates(data, { role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerCloseTodayTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerCloseTodayItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "Сейчас в CRM нет сделок, которые критично нужно закрыть именно сегодня."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `Сегодня нужно закрыть ${items.length} пункт(а) по вашим сделкам:`
      : `Сегодня нужно закрыть ${items.length} пункт(а) по CRM:`,
    "",
    ...visible.map((item, index) => `${index + 1}. ${item.lead} — ${item.reason}`)
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в CRM.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(visible, (item) => item.section || "workflow")
    )
  };
}

function getManagerProductionItems(data, subscriber, { allowFallback = true } = {}) {
  const productionPredicate = (item) => {
    const text = normalizeLookupText(item?.dealStage, item?.productionStatus, item?.status);
    return (
      String(item?.status || "") === "WON" ||
      hasNormalizedKeyword(text, [
        "производ",
        "распил",
        "сборк",
        "установ",
        "монтаж"
      ])
    );
  };

  return getScopedItems(
    data.leads.filter((item) => productionPredicate(item)),
    (item) => matchesSubscriberOwner(item.manager, subscriber),
    { allowFallback }
  );
}

function buildManagerProductionTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerProductionItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "Сейчас в CRM нет сделок, которые уже ушли в производство."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `В производстве у вас ${items.length} сделок(и):`
      : `В производстве по CRM ${items.length} сделок(и):`,
    "",
    ...visible.map((item, index) => {
      const productionLabel = item.productionStatus || item.dealStage || "Статус уточняется";
      return `${index + 1}. ${item.lead || item.name} — ${productionLabel}`;
    })
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в карточках сделок.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(buildLeadLinkRows(visible, () => "production"))
  };
}

function getManagerTomorrowItems(data, subscriber, { allowFallback = true } = {}) {
  const now = data.now;
  const leadNamesBySlug = buildLeadNamesMap(data.leads);
  const collectItems = (targetSubscriber) => {
    const items = [];
    const seen = new Set();
    const pushItem = (candidate) => {
      const dedupeKey = [
        candidate?.slug || "",
        candidate?.title || "",
        candidate?.fallbackText || "",
        candidate?.section || ""
      ].join("|");

      if (!candidate?.slug || seen.has(dedupeKey)) {
        return;
      }

      seen.add(dedupeKey);
      items.push(candidate);
    };

    for (const appointment of data.activeAppointments.filter((item) => {
      return (
        item.appointmentDate &&
        isTomorrowDay(item.appointmentDate, now) &&
        matchesSubscriberOwner(item.owner || item.measurer, targetSubscriber)
      );
    })) {
      pushItem({
        slug: appointment.slug,
        lead: appointment.lead,
        title: `${appointment.typeLabel || appointment.type}`,
        when: appointment.appointmentDate,
        fallbackText: appointment.scheduledAt,
        section: "measurements"
      });
    }

    for (const followup of data.followups.filter((item) => {
      return (
        item.dueDate &&
        isTomorrowDay(item.dueDate, now) &&
        matchesSubscriberOwner(item.owner, targetSubscriber)
      );
    })) {
      pushItem({
        slug: followup.slug,
        lead: followup.lead,
        title: followup.type,
        when: followup.dueDate,
        fallbackText: followup.scheduledAt,
        section: "followups"
      });
    }

    const taskQueue = Array.isArray(data.workboard?.taskQueue) ? data.workboard.taskQueue : [];

    for (const task of taskQueue) {
      const deadlineDate = parseBusinessDate(task.deadline);

      if (!deadlineDate || !isTomorrowDay(deadlineDate, now)) {
        continue;
      }

      if (!matchesSubscriberOwner(task.owner, targetSubscriber)) {
        continue;
      }

      pushItem({
        slug: task.slug,
        lead: leadNamesBySlug.get(task.slug) || task.lead || task.title,
        title: task.title,
        when: deadlineDate,
        fallbackText: task.deadline,
        section: resolveManagerTaskSection(task)
      });
    }

    return items.sort((left, right) => {
      const leftTime = left.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      const rightTime = right.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  };

  const scopedItems = collectItems(subscriber);

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: collectItems({ role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerTomorrowTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerTomorrowItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "На завтра в CRM пока нет активных замеров, возвратов или задач."
    };
  }

  const visible = items.slice(0, 5);
  const lines = [
    scopedToSubscriber
      ? `На завтра у вас ${items.length} пункт(а) в работе:`
      : `На завтра по CRM ${items.length} пункт(а) в работе:`,
    "",
    ...visible.map(
      (item, index) =>
        `${index + 1}. ${item.lead} — ${item.title}, ${formatDispatchDate(
          item.when,
          item.fallbackText
        )}`
    )
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в CRM.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(visible, (item) => item.section || "summary")
    )
  };
}

function getManagerUnansweredItems(data, subscriber, { allowFallback = true } = {}) {
  const activeAppointmentSlugs = new Set(data.activeAppointments.map((item) => item.slug).filter(Boolean));
  const collectItems = (targetSubscriber) => {
    const seen = new Set();
    const items = [];
    const pushItem = (candidate) => {
      if (!candidate?.slug || seen.has(candidate.slug)) {
        return;
      }

      seen.add(candidate.slug);
      items.push(candidate);
    };

    for (const lead of data.leads.filter((item) => matchesSubscriberOwner(item.manager, targetSubscriber))) {
      const status = String(lead.status || "");

      if (activeAppointmentSlugs.has(lead.slug)) {
        continue;
      }

      if (status === "NEW") {
        pushItem({
          slug: lead.slug,
          lead: lead.lead || lead.name,
          reason: "Новая заявка, клиент ещё без ответа",
          when: parseBusinessDate(lead.nextContactAt) || parseBusinessDate(lead.deadline),
          fallbackText: lead.nextContactAt || lead.deadline,
          section: "workflow"
        });
      }

      if (status === "CONTACTED") {
        pushItem({
          slug: lead.slug,
          lead: lead.lead || lead.name,
          reason: "После контакта ждём ответ клиента",
          when: parseBusinessDate(lead.nextContactAt) || parseBusinessDate(lead.deadline),
          fallbackText: lead.nextContactAt || lead.deadline,
          section: "workflow"
        });
      }
    }

    for (const followup of data.overdueFollowups.filter((item) =>
      matchesSubscriberOwner(item.owner, targetSubscriber)
    )) {
      pushItem({
        slug: followup.slug,
        lead: followup.lead,
        reason: `Нет ответа после шага: ${String(followup.type || "возврат").toLowerCase()}`,
        when: followup.dueDate,
        fallbackText: followup.scheduledAt,
        section: "followups"
      });
    }

    return items.sort((left, right) => {
      const leftTime = left.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      const rightTime = right.when?.getTime?.() || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  };

  const scopedItems = collectItems(subscriber);

  if (scopedItems.length || !allowFallback) {
    return {
      items: scopedItems,
      scopedToSubscriber: scopedItems.length > 0
    };
  }

  return {
    items: collectItems({ role: "manager", name: null }),
    scopedToSubscriber: false
  };
}

function buildManagerUnansweredTextMessage(data, subscriber) {
  const { items, scopedToSubscriber } = getManagerUnansweredItems(data, subscriber, {
    allowFallback: true
  });

  if (!items.length) {
    return {
      text: "Сейчас в CRM нет клиентов без ответа, которых нужно дожимать."
    };
  }

  const visible = items.slice(0, 4);
  const lines = [
    scopedToSubscriber
      ? `Сейчас без ответа ${items.length} клиент(ом/ами) по вашим сделкам:`
      : `Сейчас без ответа ${items.length} клиент(ом/ами) по CRM:`,
    "",
    ...visible.map(
      (item, index) =>
        `${index + 1}. ${item.lead} — ${item.reason}${
          item.when || item.fallbackText
            ? `, ${formatDispatchDate(item.when, item.fallbackText)}`
            : ""
        }`
    )
  ];

  if (items.length > visible.length) {
    lines.push("", `Ещё ${items.length - visible.length} смотрите в /control.`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(visible, (item) => item.section || "workflow")
    )
  };
}

function buildManagerDailyCommercialTextMessage(data, subscriber) {
  const estimateScope = getManagerEstimateItems(data, subscriber, { allowFallback: true });
  const paymentScope = getManagerPaymentItems(data, subscriber, { allowFallback: true });
  const alertScope = getScopedItems(
    data.alerts.filter((item) => {
      const text = normalizeLookupText(item.action, item.detail, item.lead);
      return hasNormalizedKeyword(text, ["кп", "смет", "расч", "предоплат", "оплат"]);
    }),
    (item) => matchesSubscriberOwner(item.owner, subscriber),
    { allowFallback: true }
  );

  const prepaymentWaitingCount = paymentScope.items.filter((item) =>
    normalizeLookupText(item.prepaymentStatus).includes("ожида")
  ).length;
  const prepaymentReceivedCount = paymentScope.items.filter((item) =>
    normalizeLookupText(item.prepaymentStatus).includes("получ")
  ).length;
  const visibleEstimateItems = estimateScope.items.slice(0, 2);
  const visiblePaymentItems = paymentScope.items.slice(0, 2);
  const visibleAlertItems = alertScope.items.slice(0, 2);
  const linkItems = [];
  const seen = new Set();

  for (const item of [...visibleEstimateItems, ...visiblePaymentItems, ...visibleAlertItems]) {
    if (!item?.slug || seen.has(item.slug)) {
      continue;
    }

    seen.add(item.slug);
    linkItems.push(item);
  }

  const lines = [
    estimateScope.scopedToSubscriber || paymentScope.scopedToSubscriber
      ? "КП, сметы и оплаты за день по вашим сделкам:"
      : "КП, сметы и оплаты за день по CRM:",
    "",
    `КП и сметы в работе: ${estimateScope.items.length}`,
    `Ждут предоплату: ${prepaymentWaitingCount}`,
    `Предоплата получена: ${prepaymentReceivedCount}`
  ];

  if (visibleAlertItems.length) {
    lines.push(
      "",
      "Сигналы за день:",
      ...visibleAlertItems.map(
        (item, index) => `${index + 1}. ${item.lead} — ${item.action}`
      )
    );
  }

  if (visibleEstimateItems.length) {
    lines.push(
      "",
      "Фокус по сметам:",
      ...visibleEstimateItems.map(
        (item, index) =>
          `${index + 1}. ${item.lead || item.name} — ${item.calculationStatus}`
      )
    );
  }

  if (visiblePaymentItems.length) {
    lines.push(
      "",
      "Фокус по оплатам:",
      ...visiblePaymentItems.map(
        (item, index) =>
          `${index + 1}. ${item.lead || item.name} — ${item.prepaymentStatus}`
      )
    );
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildInlineKeyboard(
      buildLeadLinkRows(linkItems, (item) => {
        const text = normalizeLookupText(
          item.action,
          item.detail,
          item.calculationStatus,
          item.prepaymentStatus
        );

        if (hasNormalizedKeyword(text, ["предоплат", "оплат"])) {
          return resolvePaymentLeadSection(item);
        }

        return "estimate";
      })
    )
  };
}

function resolveTelegramTextIntent(text, subscriber) {
  if (!subscriber || subscriber.role !== "manager") {
    return null;
  }

  const normalized = normalizeLookupText(text);
  const containsAny = (...keywords) => keywords.some((keyword) => normalized.includes(keyword));

  if (!normalized) {
    return null;
  }

  const asksQuotesToday =
    normalized === "что по кп за сегодня" ||
    normalized === "что по сметам за сегодня" ||
    normalized === "кп за сегодня" ||
    normalized === "сметы за сегодня" ||
    normalized === "кп сегодня" ||
    ((containsAny("сегодня", "за сегодня") &&
      containsAny("кп", "смет", "расч", "коммерчес")) ||
      (containsAny("что по") && containsAny("кп", "смет", "расч")));

  if (asksQuotesToday) {
    return {
      key: "manager_quotes_today",
      ttlSeconds: 20
    };
  }

  const asksCloseToday =
    normalized === "кого надо закрыть сегодня" ||
    normalized === "кого закрыть сегодня" ||
    normalized === "что закрыть сегодня" ||
    normalized === "кого дожать сегодня" ||
    normalized === "закрыть сегодня" ||
    ((containsAny("сегодня") &&
      containsAny("закрыть", "дожать", "добить", "довести")) ||
      (containsAny("кого", "что") && containsAny("закрыть", "дожать") && containsAny("сегодня")));

  if (asksCloseToday) {
    return {
      key: "manager_close_today",
      ttlSeconds: 20
    };
  }

  const asksPaymentsToday =
    normalized === "что по оплатам за сегодня" ||
    normalized === "оплаты за сегодня" ||
    normalized === "что по предоплатам за сегодня" ||
    normalized === "оплаты сегодня" ||
    ((containsAny("сегодня", "за сегодня") &&
      containsAny("предоплат", "аванс", "оплат", "остаток", "платеж")) ||
      (containsAny("что по") && containsAny("оплат", "предоплат", "аванс")));

  if (asksPaymentsToday) {
    return {
      key: "manager_payments_today",
      ttlSeconds: 20
    };
  }

  const asksTomorrowPayments =
    normalized === "что завтра по оплатам" ||
    normalized === "завтра по оплатам" ||
    normalized === "оплаты завтра" ||
    normalized === "предоплата завтра" ||
    normalized === "что завтра по предоплатам" ||
    ((containsAny("завтра") || containsAny("на завтра")) &&
      containsAny("предоплат", "аванс", "оплат", "остаток", "платеж"));

  if (asksTomorrowPayments) {
    return {
      key: "manager_tomorrow_payments",
      ttlSeconds: 20
    };
  }

  const asksPrepaymentPush =
    normalized === "кого дожимать до предоплаты" ||
    normalized === "кого дожать до предоплаты" ||
    normalized === "дожим до предоплаты" ||
    normalized === "кого закрыть на предоплату" ||
    normalized === "кого вести до предоплаты" ||
    ((containsAny("дожим", "дожать", "закрыть", "довести", "вести") &&
      containsAny("предоплат", "аванс")) ||
      (containsAny("кого") && containsAny("предоплат", "аванс")));

  if (asksPrepaymentPush) {
    return {
      key: "manager_prepayment_push",
      ttlSeconds: 20
    };
  }

  const asksStuckAfterEstimate =
    normalized === "кто завис после кп" ||
    normalized === "кто завис после сметы" ||
    normalized === "после кп" ||
    normalized === "после сметы" ||
    normalized === "кп зависло" ||
    ((containsAny("завис", "застрял", "стоит", "после") &&
      containsAny("кп", "смет", "расч", "коммерчес")) ||
      (containsAny("кто") && containsAny("кп", "смет") && containsAny("завис", "после")));

  if (asksStuckAfterEstimate) {
    return {
      key: "manager_stuck_after_estimate",
      ttlSeconds: 20
    };
  }

  const asksPayments =
    normalized === "оплата" ||
    normalized === "оплаты" ||
    normalized === "предоплата" ||
    normalized === "аванс" ||
    normalized === "остаток" ||
    normalized === "платеж" ||
    normalized === "платежи" ||
    normalized === "деньги" ||
    containsAny("предоплат", "аванс", "оплат", "остаток", "платеж", "деньг");

  if (asksPayments) {
    return {
      key: "manager_payments",
      ttlSeconds: 20
    };
  }

  const asksDailyCommercial =
    normalized === "что по кп" ||
    normalized === "что по сметам" ||
    normalized === "что по оплатам" ||
    normalized === "кп за день" ||
    normalized === "сметы за день" ||
    normalized === "оплаты за день" ||
    normalized === "итоги дня" ||
    ((containsAny("кп", "смет", "оплат", "предоплат", "расч") &&
      containsAny("день", "за день", "за сегодня", "итоги", "сегодня")) ||
      (containsAny("что по", "итоги") &&
        containsAny("кп", "смет", "оплат", "предоплат", "расч")));

  if (asksDailyCommercial) {
    return {
      key: "manager_daily_commercial",
      ttlSeconds: 20
    };
  }

  const asksProduction =
    normalized === "производство" ||
    normalized === "распил" ||
    normalized === "сборка" ||
    normalized === "установка" ||
    normalized === "монтаж" ||
    containsAny("производ", "распил", "сборк", "установ", "монтаж");

  if (asksProduction) {
    return {
      key: "manager_production",
      ttlSeconds: 20
    };
  }

  const asksFollowups =
    normalized === "возврат" ||
    normalized === "возвраты" ||
    normalized === "просрочка" ||
    normalized === "просрочено" ||
    normalized === "дожим" ||
    normalized === "дожать" ||
    normalized === "перезвон" ||
    normalized === "вернуться" ||
    containsAny("возврат", "просроч", "дожим", "перезвон", "вернут", "followup");

  if (asksFollowups) {
    return {
      key: "manager_followups",
      ttlSeconds: 20
    };
  }

  const asksEstimates =
    normalized === "расчет" ||
    normalized === "расчёт" ||
    normalized === "смета" ||
    normalized === "сметы" ||
    normalized === "кп" ||
    normalized === "стоимость" ||
    normalized === "цена" ||
    normalized === "бюджет" ||
    normalized === "диапазон" ||
    containsAny("расч", "расчет", "смет", "кп", "стоимост", "цен", "бюджет", "диапазон");

  if (asksEstimates) {
    return {
      key: "manager_estimates",
      ttlSeconds: 20
    };
  }

  const asksUrgent =
    normalized === "срочно" ||
    normalized === "срочные" ||
    normalized === "срочное" ||
    normalized === "важно" ||
    normalized === "важное" ||
    normalized === "приоритет" ||
    normalized === "фокус" ||
    normalized === "горячее" ||
    containsAny("сроч", "важн", "приоритет", "фокус", "горяч");

  if (asksUrgent) {
    return {
      key: "manager_urgent",
      ttlSeconds: 20
    };
  }

  const asksTomorrow =
    normalized === "завтра" ||
    normalized === "на завтра" ||
    normalized === "план на завтра" ||
    normalized === "что завтра" ||
    normalized === "замеры завтра" ||
    normalized === "выезды завтра" ||
    normalized === "встречи завтра" ||
    containsAny("завтра");

  if (asksTomorrow) {
    return {
      key: "manager_tomorrow",
      ttlSeconds: 20
    };
  }

  const asksUnanswered =
    normalized === "кто не ответил" ||
    normalized === "не ответил" ||
    normalized === "без ответа" ||
    normalized === "нет ответа" ||
    normalized === "молчит" ||
    normalized === "молчат" ||
    normalized === "тишина" ||
    normalized === "кто молчит" ||
    containsAny("не ответ", "без ответ", "нет ответ", "молчит", "молчат", "тишин");

  if (asksUnanswered) {
    return {
      key: "manager_unanswered",
      ttlSeconds: 20
    };
  }

  const asksTodayAppointments =
    normalized === "какие замеры сегодня" ||
    normalized === "какие выезды сегодня" ||
    normalized === "что по замерам сегодня" ||
    normalized === "замеры сегодня" ||
    normalized === "выезды сегодня" ||
    normalized === "консультации сегодня" ||
    normalized === "что у меня по замерам сегодня" ||
    normalized === "сегодня" ||
    normalized === "на сегодня" ||
    normalized === "замер" ||
    normalized === "замеры" ||
    normalized === "выезд" ||
    normalized === "выезды" ||
    normalized === "консультация" ||
    normalized === "консультации" ||
    normalized === "встреча" ||
    normalized === "встречи" ||
    normalized === "шоурум" ||
    (containsAny("замер", "выезд", "консультац", "встреч", "шоурум") &&
      (normalized.includes("сегодня") || normalized.includes("на сегодня"))) ||
    containsAny("замер", "выезд", "консультац", "встреч", "шоурум");

  if (asksTodayAppointments) {
    return {
      key: "manager_today_appointments",
      ttlSeconds: 20
    };
  }

  const asksConsultationQueue =
    normalized === "кого нужно проконсультировать" ||
    normalized === "кого надо проконсультировать" ||
    normalized === "кого проконсультировать" ||
    normalized === "кого нужно созвонить" ||
    normalized === "кому нужно позвонить" ||
    normalized === "с кем нужно связаться" ||
    normalized === "кого нужно обработать" ||
    normalized === "кого" ||
    normalized === "кому" ||
    normalized === "позвонить" ||
    normalized === "созвонить" ||
    normalized === "связаться" ||
    normalized === "проконсультировать" ||
    normalized === "клиенты" ||
    normalized === "клиент" ||
    ((containsAny("проконсульт", "позвон", "созвон", "связат", "клиент", "контакт") ||
      (normalized.includes("консультац") &&
        (normalized.includes("кого") ||
          normalized.includes("кому") ||
          normalized.includes("нужно") ||
          normalized.includes("надо")))) &&
      (normalized.includes("кого") ||
        normalized.includes("кому") ||
        normalized.includes("с кем") ||
        normalized.includes("нужно") ||
        normalized.includes("надо") ||
        normalized.includes("клиент")));

  if (asksConsultationQueue) {
    return {
      key: "manager_consultation_queue",
      ttlSeconds: 20
    };
  }

  return null;
}

async function buildTelegramTextIntentMessages(intentKey, subscriber) {
  const data = await collectTelegramControlData();

  switch (intentKey) {
    case "manager_quotes_today":
      return [buildManagerQuotesTodayTextMessage(data, subscriber)];
    case "manager_close_today":
      return [buildManagerCloseTodayTextMessage(data, subscriber)];
    case "manager_payments_today":
      return [buildManagerPaymentsTodayTextMessage(data, subscriber)];
    case "manager_tomorrow_payments":
      return [buildManagerTomorrowPaymentsTextMessage(data, subscriber)];
    case "manager_prepayment_push":
      return [buildManagerPrepaymentPushTextMessage(data, subscriber)];
    case "manager_stuck_after_estimate":
      return [buildManagerStuckAfterEstimateTextMessage(data, subscriber)];
    case "manager_tomorrow":
      return [buildManagerTomorrowTextMessage(data, subscriber)];
    case "manager_unanswered":
      return [buildManagerUnansweredTextMessage(data, subscriber)];
    case "manager_daily_commercial":
      return [buildManagerDailyCommercialTextMessage(data, subscriber)];
    case "manager_urgent":
      return [buildManagerUrgentTextMessage(data, subscriber)];
    case "manager_followups":
      return [buildManagerFollowupTextMessage(data, subscriber)];
    case "manager_estimates":
      return [buildManagerEstimateTextMessage(data, subscriber)];
    case "manager_payments":
      return [buildManagerPaymentsTextMessage(data, subscriber)];
    case "manager_production":
      return [buildManagerProductionTextMessage(data, subscriber)];
    case "manager_today_appointments":
      return [buildManagerAppointmentsTextMessage(data, subscriber)];
    case "manager_consultation_queue":
      return [buildManagerConsultationTextMessage(data, subscriber)];
    default:
      return [];
  }
}

function resolveClientTextIntent(text) {
  const normalized = normalizeLookupText(text);

  if (!normalized) {
    return null;
  }

  if (
    hasNormalizedKeyword(normalized, ["заявка", "оставить заявку", "заказ", "хочу заказать"])
  ) {
    return "request";
  }

  if (
    hasNormalizedKeyword(normalized, ["статус", "где заказ", "мой заказ", "статус заказа"])
  ) {
    return "status";
  }

  if (
    hasNormalizedKeyword(normalized, ["замер", "подтвердить замер", "подтвердить выезд"])
  ) {
    return "confirm";
  }

  if (
    hasNormalizedKeyword(normalized, ["расчет", "расчёт", "смета", "цена", "стоимость", "кп"])
  ) {
    return "estimate";
  }

  if (
    hasNormalizedKeyword(normalized, ["предоплата", "аванс", "оплата", "оплатить", "остаток"])
  ) {
    return "deposit";
  }

  if (
    hasNormalizedKeyword(normalized, ["менеджер", "связаться", "перезвоните", "позвоните", "контакт"])
  ) {
    return "manager";
  }

  if (hasNormalizedKeyword(normalized, ["crm", "приложение", "app", "mini app"])) {
    return "app";
  }

  if (
    hasNormalizedKeyword(normalized, [
      "pilot",
      "launch",
      "go live",
      "пилот",
      "запуск",
      "запустить crm",
      "внедрение",
      "подключить"
    ])
  ) {
    return "pilot";
  }

  if (
    hasNormalizedKeyword(normalized, ["демо", "demo", "как это работает", "как работает", "показать демо"])
  ) {
    return "demo";
  }

  return null;
}

function buildClientLookupPrompt(actionLabel) {
  return `${actionLabel}\n\nПришли номер телефона или номер заказа, чтобы я нашёл карточку в CRM.`;
}

async function findLeadForClientChat(chat, from, reference = null) {
  return findTelegramClientLead({
    chatId: chat?.id ? String(chat.id) : null,
    telegramUserId: from?.id ? String(from.id) : null,
    username: from?.username || null,
    reference
  });
}

function buildClientStatusText(lead) {
  return [
    `Статус заказа: ${lead?.deal?.status || lead?.dealStage || "Уточняется"}`,
    `Изделие: ${lead?.deal?.productType || lead?.product || "Уточняется"}`,
    `Следующий шаг: ${lead?.deal?.nextStep || lead?.nextAction || "Менеджер обновит после контакта"}`,
    `Менеджер: ${lead?.deal?.responsible || lead?.manager || "Назначается"}`,
    `Следующий контакт: ${lead?.deal?.nextContactAt || lead?.nextContactAt || "Уточняется"}`
  ].join("\n");
}

function buildClientEstimateText(lead) {
  return [
    `Расчёт: ${lead?.calculationStatus || lead?.deal?.calculationStatus || "Уточняется"}`,
    `Диапазон: ${lead?.estimateRange || lead?.order?.estimate?.preliminaryAmount || "После брифа и замера"}`,
    `Итоговая сумма: ${lead?.order?.calculation?.finalAmount || lead?.finalAmount || "Ещё не зафиксирована"}`,
    `Комментарий: ${lead?.project?.designerComment || lead?.managerComment || "Менеджер подготовит расчёт после уточнений"}`
  ].join("\n");
}

function buildClientDepositText(lead) {
  return [
    `Предоплата: ${lead?.prepaymentStatus || lead?.deal?.prepaymentStatus || "Уточняется"}`,
    `Сумма предоплаты: ${lead?.order?.calculation?.prepaymentAmount || lead?.deal?.prepaymentAmount || "Ещё не выставлена"}`,
    `Остаток к оплате: ${lead?.order?.calculation?.balanceDue || "Будет показан после расчёта"}`,
    `Следующий шаг: ${lead?.deal?.nextStep || lead?.nextAction || "Менеджер отправит детали оплаты"}`
  ].join("\n");
}

function buildClientMeasurementText(lead, appointment = null) {
  const activeAppointment = appointment || (lead?.appointments || []).find((item) =>
    ["SCHEDULED", "CONFIRMED"].includes(String(item.status || "").toUpperCase())
  );

  if (!activeAppointment) {
    return "По заказу пока нет активного замера. Менеджер согласует выезд после уточнения деталей.";
  }

  return [
    `Замер: ${activeAppointment.typeLabel || activeAppointment.type || "Выезд"}`,
    `Статус: ${activeAppointment.statusLabel || activeAppointment.status || "Назначено"}`,
    `Когда: ${activeAppointment.scheduledAt || "Время уточняется"}`,
    `Адрес: ${activeAppointment.address || "Адрес уточняется"}`,
    `Ответственный: ${activeAppointment.measurer || activeAppointment.owner || "Назначается"}`
  ].join("\n");
}

function buildClientReplyMarkup(lead, options = {}) {
  const rows = [
    ...buildClientLeadActionRows(lead, options),
    [
      {
        text: "Связаться с менеджером",
        callback_data: "cl|manager"
      }
    ]
  ];

  if (options.confirmAppointmentId) {
    rows.unshift([
      {
        text: "Подтвердить замер",
        callback_data: `cl|apconfirm|${options.confirmAppointmentId}`
      }
    ]);
  }

  return buildInlineKeyboard(rows);
}

async function notifyInternalTeamAboutClientLead(lead) {
  if (!lead?.slug) {
    return [];
  }

  const subscribers = Array.from(
    getTelegramSubscribers()
      .filter((item) => ["director", "manager"].includes(item.role))
      .reduce((map, item) => {
        if (!map.has(String(item.chatId))) {
          map.set(String(item.chatId), item);
        }

        return map;
      }, new Map())
      .values()
  );

  if (!subscribers.length) {
    return [];
  }

  const text = [
    "Новая заявка из клиентского Telegram-режима",
    lead.orderNumber ? `Заказ: ${lead.orderNumber}` : null,
    `Клиент: ${lead.name || "Без имени"}`,
    `Телефон: ${lead.phone || "Не указан"}`,
    `Изделие: ${lead.product || lead.requestType || "Не указано"}`,
    `Следующий шаг: ${lead.deal?.nextStep || lead.nextAction || "Связаться с клиентом"}`,
    `Источник: ${lead.source || "Telegram"}`
  ]
    .filter(Boolean)
    .join("\n");

  const replyMarkup = buildInlineKeyboard([
    [
      buildOpenDealButton(lead.slug, "workflow", "Открыть заявку")
    ].filter(Boolean)
  ]);

  const deliveries = [];

  for (const subscriber of subscribers) {
    deliveries.push(
      await deliverTelegramMessage(subscriber.chatId, text, {
        replyMarkup,
        appButtonLabel: "Открыть CRM"
      })
    );
  }

  return deliveries;
}

async function buildPilotRequestId() {
  const requests = await refreshTelegramPilotRequestStore();
  const nextNumber =
    requests.reduce((max, item) => {
      const match = String(item?.requestNumber || item?.id || "").match(/(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

  return `PILOT-${String(nextNumber).padStart(3, "0")}`;
}

async function notifyInternalTeamAboutPilotRequest(request) {
  const subscribers = Array.from(
    getTelegramSubscribers()
      .filter((item) => ["director", "manager"].includes(item.role))
      .reduce((map, item) => {
        if (!map.has(String(item.chatId))) {
          map.set(String(item.chatId), item);
        }

        return map;
      }, new Map())
      .values()
  );

  if (!subscribers.length) {
    return [];
  }

  const text = [
    "Новая заявка на запуск пилота BOSE",
    request.requestNumber ? `Номер: ${request.requestNumber}` : null,
    `Цех: ${request.workshopName || "Не указан"}`,
    `Город: ${request.city || "Не указан"}`,
    `Команда: ${request.teamSize || "Не указана"}`,
    `Телефон: ${request.phone || "Не указан"}`,
    `Контакт: ${request.contactName || "Не указан"}`,
    `Запрос: ${request.note || "Без комментария"}`
  ]
    .filter(Boolean)
    .join("\n");

  const replyMarkup = buildInlineKeyboard([
    [buildOpenRouteButton("/", "Открыть продукт")].filter(Boolean),
    [buildOpenRouteButton("/workboard", "Открыть смену")].filter(Boolean)
  ]);

  const deliveries = [];

  for (const subscriber of subscribers) {
    deliveries.push(
      await deliverTelegramMessage(subscriber.chatId, text, {
        replyMarkup,
        appButtonLabel: "Открыть CRM"
      })
    );
  }

  return deliveries;
}

async function sendClientLeadReply(chatId, lead, text, options = {}) {
  return deliverTelegramMessage(chatId, text, {
    replyMarkup:
      options.replyMarkup ||
      buildClientReplyMarkup(lead, {
        primarySection: options.primarySection,
        primaryLabel: options.primaryLabel,
        confirmAppointmentId: options.confirmAppointmentId
      }),
    forcePreview: !isTelegramBotConfigured(),
    appButtonLabel: options.appButtonLabel || "Открыть Mini App"
  });
}

async function promptClientReferenceFlow(chatId, from, flow, text) {
  await writePendingRegistration(chatId, {
    flow,
    telegramUserId: from?.id ? String(from.id) : null,
    username: from?.username || null
  });

  return deliverTelegramMessage(chatId, text, {
    replyMarkup: buildClientMenuKeyboard(),
    forcePreview: !isTelegramBotConfigured(),
    appButtonLabel: "Открыть Mini App"
  });
}

async function startClientRequestFlow(chatId, from) {
  await writePendingRegistration(chatId, {
    flow: "client_request",
    step: "name",
    draft: {},
    telegramUserId: from?.id ? String(from.id) : null,
    username: from?.username || null
  });

  return deliverTelegramMessage(
    chatId,
    "Давай быстро оформим заявку.\n\nНапиши, как тебя зовут.",
    {
      replyMarkup: buildClientMenuKeyboard(),
      forcePreview: !isTelegramBotConfigured(),
      appButtonLabel: "Открыть Mini App"
    }
  );
}

async function startPilotRequestFlow(chatId, from) {
  await writePendingRegistration(chatId, {
    flow: "pilot_request",
    step: "workshop",
    draft: {},
    telegramUserId: from?.id ? String(from.id) : null,
    username: from?.username || null
  });

  return deliverTelegramMessage(
    chatId,
    [
      "Запускаем заявку на пилот BOSE.",
      "",
      "Напиши название мебельного цеха или студии."
    ].join("\n"),
    {
      forcePreview: !isTelegramBotConfigured(),
      appButtonLabel: "Открыть продукт"
    }
  );
}

async function handleClientRequestStep(messageText, chat, from, pendingState) {
  const draft = pendingState?.draft && typeof pendingState.draft === "object"
    ? { ...pendingState.draft }
    : {};

  if (pendingState?.step === "name") {
    draft.name = messageText;
    await writePendingRegistration(chat?.id, {
      ...pendingState,
      step: "phone",
      draft
    });

    return {
      ok: true,
      action: "client_request_phone",
      reply: await deliverTelegramMessage(chat?.id, "Отлично. Теперь пришли номер телефона.", {
        forcePreview: !isTelegramBotConfigured(),
        appButtonLabel: "Открыть Mini App"
      })
    };
  }

  if (pendingState?.step === "phone") {
    draft.phone = messageText;
    await writePendingRegistration(chat?.id, {
      ...pendingState,
      step: "product",
      draft
    });

    return {
      ok: true,
      action: "client_request_product",
      reply: await deliverTelegramMessage(
        chat?.id,
        "Что нужно изготовить? Например: кухня, шкаф, гардеробная, тумба.",
        {
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть Mini App"
        }
      )
    };
  }

  if (pendingState?.step === "product") {
    draft.product = messageText;
    await writePendingRegistration(chat?.id, {
      ...pendingState,
      step: "note",
      draft
    });

    return {
      ok: true,
      action: "client_request_note",
      reply: await deliverTelegramMessage(
        chat?.id,
        "Напиши коротко, что важно по заказу: размеры, район, пожелания, сроки.",
        {
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть Mini App"
        }
      )
    };
  }

  const createdLead = await createTelegramClientLead({
    ...draft,
    note: messageText,
    chatId: chat?.id ? String(chat.id) : null,
    telegramUserId: from?.id ? String(from.id) : null,
    username: from?.username || null
  });

  await clearPendingRegistration(chat?.id);

  if (!createdLead?.ok || !createdLead?.lead) {
    return {
      ok: false,
      action: "client_request_create",
      reply: await deliverTelegramMessage(
        chat?.id,
        createdLead?.message || "Не удалось сохранить заявку. Попробуй ещё раз или напиши менеджеру.",
        {
          replyMarkup: buildClientMenuKeyboard(),
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть Mini App"
        }
      )
    };
  }

  return {
    ok: true,
    action: "client_request_create",
    lead: createdLead.lead,
    internalNotifications: await notifyInternalTeamAboutClientLead(createdLead.lead),
    reply: await sendClientLeadReply(
      chat?.id,
      createdLead.lead,
      [
        "Заявка принята.",
        createdLead.lead.orderNumber ? `Номер заказа: ${createdLead.lead.orderNumber}` : null,
        `Этап: ${createdLead.lead.deal?.status || createdLead.lead.dealStage || "Новая заявка"}`,
        `Следующий шаг: ${createdLead.lead.deal?.nextStep || createdLead.lead.nextAction || "Менеджер свяжется с вами"}`
      ]
        .filter(Boolean)
        .join("\n"),
      {
        primarySection: "workflow",
        primaryLabel: "Открыть заявку"
      }
    )
  };
}

async function handlePilotRequestStep(messageText, chat, from, pendingState) {
  const draft =
    pendingState?.draft && typeof pendingState.draft === "object"
      ? { ...pendingState.draft }
      : {};

  if (pendingState?.step === "workshop") {
    draft.workshopName = messageText;
    await writePendingRegistration(chat?.id, {
      ...pendingState,
      step: "city",
      draft
    });

    return {
      ok: true,
      action: "pilot_request_city",
      reply: await deliverTelegramMessage(chat?.id, "В каком вы городе?", {
        forcePreview: !isTelegramBotConfigured(),
        appButtonLabel: "Открыть продукт"
      })
    };
  }

  if (pendingState?.step === "city") {
    draft.city = messageText;
    await writePendingRegistration(chat?.id, {
      ...pendingState,
      step: "team",
      draft
    });

    return {
      ok: true,
      action: "pilot_request_team",
      reply: await deliverTelegramMessage(
        chat?.id,
        "Сколько человек у вас в команде продаж и производства?",
        {
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть продукт"
        }
      )
    };
  }

  if (pendingState?.step === "team") {
    draft.teamSize = messageText;
    await writePendingRegistration(chat?.id, {
      ...pendingState,
      step: "contact",
      draft
    });

    return {
      ok: true,
      action: "pilot_request_contact",
      reply: await deliverTelegramMessage(
        chat?.id,
        "Напиши имя и номер для связи. Можно одной строкой.",
        {
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть продукт"
        }
      )
    };
  }

  if (pendingState?.step === "contact") {
    draft.contact = messageText;
    await writePendingRegistration(chat?.id, {
      ...pendingState,
      step: "note",
      draft
    });

    return {
      ok: true,
      action: "pilot_request_note",
      reply: await deliverTelegramMessage(
        chat?.id,
        "Коротко напиши, что для вас самое больное сейчас: заявки, замеры, расчёты, дожим, предоплата или контроль цеха.",
        {
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть продукт"
        }
      )
    };
  }

  const requestNumber = await buildPilotRequestId();
  const request = {
    id: requestNumber.toLowerCase(),
    requestNumber,
    workshopName: draft.workshopName || null,
    city: draft.city || null,
    teamSize: draft.teamSize || null,
    contactName: String(draft.contact || "").trim() || null,
    phone: String(draft.contact || "").trim() || null,
    note: messageText,
    telegramChatId: chat?.id ? String(chat.id) : null,
    telegramUserId: from?.id ? String(from.id) : null,
    telegramUsername: from?.username || null,
    createdAt: new Date().toISOString(),
    source: "telegram-pilot"
  };

  const persistedRequest = await persistTelegramPilotRequest(request);
  request.requestNumber = persistedRequest.requestNumber;
  await clearPendingRegistration(chat?.id);

  return {
    ok: true,
    action: "pilot_request_create",
    request: persistedRequest,
    internalNotifications: await notifyInternalTeamAboutPilotRequest(persistedRequest),
    reply: await deliverTelegramMessage(
      chat?.id,
      [
        "Заявка на пилот принята.",
        `Номер: ${request.requestNumber}`,
        "Мы свяжемся с вами и предложим запуск под ваш процесс за 7–14 дней."
      ].join("\n"),
      {
        replyMarkup: buildInlineKeyboard([
          [buildOpenRouteButton("/", "Открыть продукт")].filter(Boolean),
          [buildOpenDealButton("l-201", "summary", "Посмотреть пример заявки")].filter(Boolean),
          [buildOpenDealButton("l-206", "production", "Посмотреть производство")].filter(Boolean)
        ]),
        forcePreview: !isTelegramBotConfigured(),
        appButtonLabel: "Открыть продукт"
      }
    )
  };
}

async function handleClientReferenceLookup(flow, reference, chat, from) {
  const lead = await findLeadForClientChat(chat, from, reference);

  if (!lead) {
    await clearPendingRegistration(chat?.id);

    return {
      ok: false,
      action: flow,
      reply: await deliverTelegramMessage(
        chat?.id,
        "Не нашёл заказ по этому номеру. Можно оставить новую заявку прямо здесь.",
        {
          replyMarkup: buildClientMenuKeyboard(),
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть Mini App"
        }
      )
    };
  }

  await clearPendingRegistration(chat?.id);
  return handleClientIntent(flow.replace("client_", "").replace("_lookup", ""), chat, from, lead);
}

async function handleClientIntent(intent, chat, from, resolvedLead = null) {
  const lead = resolvedLead || (await findLeadForClientChat(chat, from));

  if (intent === "request") {
    return {
      ok: true,
      action: "client_request",
      reply: await startClientRequestFlow(chat?.id, from)
    };
  }

  if (intent === "pilot") {
    return {
      ok: true,
      action: "pilot_request",
      reply: await startPilotRequestFlow(chat?.id, from)
    };
  }

  if (intent === "app") {
    return {
      ok: true,
      action: "client_app",
      reply: await deliverTelegramMessage(chat?.id, buildClientHelpText(lead), {
        replyMarkup: buildClientMenuKeyboard(lead),
        forcePreview: !isTelegramBotConfigured(),
        appButtonLabel: "Открыть Mini App"
      })
    };
  }

  if (intent === "demo") {
    return {
      ok: true,
      action: "client_demo",
        reply: await deliverTelegramMessage(chat?.id, buildClientDemoTextV2(), {
          replyMarkup: buildClientDemoReplyMarkupV2(lead),
        forcePreview: !isTelegramBotConfigured(),
        appButtonLabel: "Открыть Mini App"
      })
    };
  }

  if (!lead?.slug) {
    const flowMap = {
      status: "client_status_lookup",
      confirm: "client_confirm_lookup",
      estimate: "client_estimate_lookup",
      deposit: "client_deposit_lookup",
      manager: "client_manager_lookup"
    };

    return {
      ok: true,
      action: intent,
      reply: await promptClientReferenceFlow(
        chat?.id,
        from,
        flowMap[intent],
        buildClientLookupPrompt(
          intent === "status"
            ? "Посмотрю статус заказа."
            : intent === "confirm"
              ? "Найду ваш замер и помогу подтвердить выезд."
              : intent === "estimate"
                ? "Найду расчёт по заказу."
                : intent === "deposit"
                  ? "Найду блок предоплаты по заказу."
                  : "Найду заказ и передам менеджеру, что вы ждёте ответ."
        )
      )
    };
  }

  if (intent === "status") {
    return {
      ok: true,
      action: "client_status",
      lead,
      reply: await sendClientLeadReply(chat?.id, lead, buildClientStatusText(lead), {
        primarySection: "summary",
        primaryLabel: "Открыть статус заказа"
      })
    };
  }

  if (intent === "confirm") {
    const activeAppointment = (lead.appointments || []).find((item) =>
      ["SCHEDULED", "CONFIRMED"].includes(String(item.status || "").toUpperCase())
    );

    return {
      ok: true,
      action: "client_confirm",
      lead,
      reply: await sendClientLeadReply(
        chat?.id,
        lead,
        buildClientMeasurementText(lead, activeAppointment),
        {
          primarySection: "measurements",
          primaryLabel: "Открыть замер",
          confirmAppointmentId:
            activeAppointment?.status === "SCHEDULED" ? activeAppointment.id : null
        }
      )
    };
  }

  if (intent === "estimate") {
    return {
      ok: true,
      action: "client_estimate",
      lead,
      reply: await sendClientLeadReply(chat?.id, lead, buildClientEstimateText(lead), {
        primarySection: "estimate",
        primaryLabel: "Открыть расчёт"
      })
    };
  }

  if (intent === "deposit") {
    return {
      ok: true,
      action: "client_deposit",
      lead,
      reply: await sendClientLeadReply(chat?.id, lead, buildClientDepositText(lead), {
        primarySection: "production",
        primaryLabel: "Открыть оплату"
      })
    };
  }

  if (intent === "manager") {
    await createFollowup({
      lead: lead.slug || lead.name,
      owner: lead.manager || "Не назначен",
      type: "message",
      scheduledAt: new Date().toISOString(),
      note: "Клиент попросил связаться с ним через Telegram-бот."
    }).catch(() => null);

    return {
      ok: true,
      action: "client_manager",
      lead,
      reply: await sendClientLeadReply(
        chat?.id,
        lead,
        [
          "Запрос менеджеру отправлен.",
          `Ответственный: ${lead.manager || "Будет назначен"}`,
          `Следующий шаг: ${lead.nextAction || lead.deal?.nextStep || "Менеджер свяжется с вами"}`
        ].join("\n"),
        {
          primarySection: "workflow",
          primaryLabel: "Открыть карточку заказа"
        }
      )
    };
  }

  return null;
}

async function handleClientPendingFlow(messageText, chat, from, pendingState) {
  if (!pendingState?.flow || !messageText) {
    return null;
  }

  if (pendingState.flow === "client_request") {
    return handleClientRequestStep(messageText, chat, from, pendingState);
  }

  if (pendingState.flow === "pilot_request") {
    return handlePilotRequestStep(messageText, chat, from, pendingState);
  }

  if (pendingState.flow.endsWith("_lookup")) {
    return handleClientReferenceLookup(pendingState.flow, messageText, chat, from);
  }

  return null;
}

async function handleTelegramTextIntent(text, chat, subscriber) {
  const intent = resolveTelegramTextIntent(text, subscriber);

  if (!intent) {
    return null;
  }

  if (!canRunTelegramCommand(chat?.id, intent.key, intent.ttlSeconds || 20)) {
    return {
      ok: true,
      action: intent.key,
      throttled: true,
      message: "Повтор текстового запроса подавлен антиспам-защитой."
    };
  }

  const messages = await buildTelegramTextIntentMessages(intent.key, subscriber);
  const replies = [];

  for (const message of messages) {
    replies.push(
      await deliverTelegramMessage(chat?.id, message.text, {
        replyMarkup: message.replyMarkup,
        forcePreview: !isTelegramBotConfigured()
      })
    );
  }

  if (replies.some((item) => item?.mode === "sent")) {
    await markTelegramCommandRun(chat?.id, intent.key);
  }

  return {
    ok: true,
    action: intent.key,
    replies
  };
}

async function buildCommandMessages(command, subscriber) {
  const data = await collectTelegramControlData();
  const now = data.now;

  switch (command) {
    case "today":
    case "digest":
      if (!subscriber) {
        return [{ text: "Сначала привяжи чат через /register директор|менеджер|замерщик Имя." }];
      }

      return buildDispatchMessagesForSubscriber(data, subscriber).slice(0, 4).map((item) => ({
        text: item.text,
        replyMarkup: item.replyMarkup
      }));

    case "control": {
      if (!subscriber) {
        return [{ text: "Сначала привяжи чат через /register директор|менеджер|замерщик Имя." }];
      }

      const controlMessages = buildDispatchMessagesForSubscriber(data, subscriber, "control")
        .slice(0, 5)
        .map((item) => ({
          text: item.text,
          replyMarkup: item.replyMarkup
        }));

      if (controlMessages.length) {
        return controlMessages;
      }

      if (subscriber.role === "director") {
        return [{ text: "Сейчас нет критичных сигналов для директорского контроля." }];
      }

      if (subscriber.role === "manager") {
        return [{ text: "Сейчас нет просроченных возвратов и срочных сигналов по вашим сделкам." }];
      }

      return [{ text: "Сейчас нет ближайших замеров или встреч, требующих подтверждения." }];
    }

    case "alerts": {
      if (!subscriber) {
        return [{ text: "Сначала привяжи чат через /register директор|менеджер|замерщик Имя." }];
      }

      const scopedFollowups = data.overdueFollowups
        .filter((item) => matchesSubscriberOwner(item.owner, subscriber))
        .slice(0, 4);

      if (!scopedFollowups.length) {
        return [{ text: "Просроченных возвратов сейчас нет." }];
      }

      return scopedFollowups.map((item) => ({
        text: [
          "Просроченный возврат",
          `${item.lead}`,
          `${item.type}`,
          `Когда: ${formatDispatchDate(item.dueDate, item.scheduledAt)}`
        ].join("\n"),
        replyMarkup: buildFollowupActionMessage(item, subscriber, now).replyMarkup
      }));
    }

    case "appointments": {
      if (!subscriber) {
        return [{ text: "Сначала привяжи чат через /register директор|менеджер|замерщик Имя." }];
      }

      const scopedAppointments = data.todayAppointments
        .filter((item) => matchesSubscriberOwner(item.owner || item.measurer, subscriber))
        .slice(0, 4);

      if (!scopedAppointments.length) {
        return [{ text: "На сегодня активных замеров и встреч нет." }];
      }

      return scopedAppointments.map((item) => ({
        text: buildAppointmentActionMessage(item, subscriber, now).text,
        replyMarkup: buildAppointmentActionMessage(item, subscriber, now).replyMarkup
      }));
    }

    default:
      return [{ text: buildHelpText(subscriber) }];
  }
}

export async function handleTelegramCommand(text, from, chat) {
  await Promise.all([
    refreshTelegramSubscriberStore(),
    refreshTelegramRegistrationStateStore(),
    refreshTelegramDispatchLogStore()
  ]);

  const commandText = String(text || "").trim();
  const [rawCommand, ...rest] = commandText.split(/\s+/);
  const command = rawCommand.replace(/^\//, "").toLowerCase();
  const startPayload = command === "start" ? normalizeTelegramStartPayload(rest.join(" ")) : null;
  const throttledCommands = new Set(["today", "digest", "control", "alerts", "appointments"]);
  const currentSubscriber =
    getTelegramSubscribers().find((item) => String(item.chatId) === String(chat?.id)) || null;
  const currentClientLead = currentSubscriber ? null : await findLeadForClientChat(chat, from);

  if (command === "start" && startPayload) {
    if (!currentSubscriber) {
      return handleClientIntent(startPayload, chat, from, currentClientLead);
    }

    if (startPayload === "demo") {
      return handleTelegramCommand("/demo", from, chat);
    }

    if (startPayload === "pilot") {
      return handleClientIntent("pilot", chat, from, currentClientLead);
    }
  }

  if (throttledCommands.has(command) && !canRunTelegramCommand(chat?.id, command, 30)) {
    return {
      ok: true,
      action: command,
      throttled: true,
      message: "Повтор команды подавлен антиспам-защитой."
    };
  }

  if (command === "start" || command === "help") {
    const reply = currentSubscriber
      ? await deliverTelegramMessage(chat?.id, buildHelpText(currentSubscriber), {
          forcePreview: !isTelegramBotConfigured()
        })
      : await deliverTelegramMessage(chat?.id, buildClientHelpText(currentClientLead), {
          replyMarkup: buildClientMenuKeyboard(currentClientLead),
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть Mini App"
        });

    return {
      ok: true,
      action: currentSubscriber ? "help" : "client_help",
      reply
    };
  }

  if (command === "demo") {
    const reply = currentSubscriber
      ? await deliverTelegramMessage(
          chat?.id,
          [
            "Сценарий продающего демо:",
            "",
            "1. Откройте бота и создайте клиентскую заявку.",
            "2. Покажите, как сделка появляется в CRM.",
            "3. Откройте смену и карточку заказа.",
            "4. Покажите замер, расчёт, предоплату и контроль цеха."
          ].join("\n"),
          {
            replyMarkup: buildInlineKeyboard(
              [
                [buildOpenDealButton("l-201", "summary", "Новая заявка")],
                [buildOpenDealButton("l-202", "estimate", "Расчёт и проект")],
                [buildOpenDealButton("l-206", "production", "Предоплата и производство")],
                [buildOpenRouteButton("/workboard", "Открыть смену")],
                [buildOpenRouteButton("/appointments", "Открыть замеры")],
                [buildOpenBotStartButton("pilot", "Запросить запуск пилота")]
              ].filter((row) => row.every(Boolean))
            ),
            forcePreview: !isTelegramBotConfigured()
          }
        )
      : await deliverTelegramMessage(chat?.id, buildClientDemoTextV2(), {
          replyMarkup: buildClientDemoReplyMarkupV2(currentClientLead),
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть Mini App"
        });

    return {
      ok: true,
      action: currentSubscriber ? "demo" : "client_demo",
      reply
    };
  }

  if (command === "pilot") {
    return handleClientIntent("pilot", chat, from, currentClientLead);
  }

  if (command === "status") {
    if (!currentSubscriber) {
      return handleClientIntent("status", chat, from, currentClientLead);
    }

    const textReply = currentSubscriber
      ? [
          "Чат привязан.",
          `Роль: ${getTelegramRoleLabel(currentSubscriber.role)}`,
          currentSubscriber.name ? `Имя в системе: ${currentSubscriber.name}` : null
        ]
          .filter(Boolean)
          .join("\n")
      : "Чат ещё не привязан. Используй /register директор|менеджер|замерщик Имя.";
    const reply = await deliverTelegramMessage(chat?.id, textReply, {
      forcePreview: !isTelegramBotConfigured()
    });

    return {
      ok: true,
      action: "status",
      reply
    };
  }

  if (command === "register") {
    const [roleToken, ...nameTokens] = rest;
    const role = normalizeTelegramRole(roleToken);
    const name =
      nameTokens.join(" ").trim() ||
      from?.first_name ||
      from?.username ||
      "Сотрудник";

    if (!role) {
      await writePendingRegistration(chat?.id, {
        flow: "register",
        telegramUserId: from?.id ? String(from.id) : null,
        username: from?.username || null
      });

      const reply = await deliverTelegramMessage(
        chat?.id,
        "Выбери роль кнопкой ниже или напиши команду целиком: /register директор Имя, /register менеджер Имя, /register замерщик Имя.",
        {
          replyMarkup: buildRegistrationRoleKeyboard(),
          forcePreview: !isTelegramBotConfigured()
        }
      );

      return {
        ok: false,
        action: "register",
        reply
      };
    }

    const subscriber = {
      chatId: String(chat?.id),
      role,
      name,
      username: from?.username || null,
      telegramUserId: from?.id ? String(from.id) : null,
      source: isRuntimeStatePostgresEnabled(getCompanyId()) ? "postgres" : "mock-store"
    };

    await upsertTelegramSubscriber(subscriber);
    await clearPendingRegistration(chat?.id);

    const reply = await deliverTelegramMessage(
      chat?.id,
      [
        "Чат привязан к роли.",
        `Роль: ${getTelegramRoleLabel(role)}`,
        `Имя: ${name}`,
        "",
        "Теперь доступны /today, /control, /alerts, /appointments и кнопки контроля."
      ].join("\n"),
      {
        forcePreview: !isTelegramBotConfigured()
      }
    );

    return {
      ok: true,
      action: "register",
      subscriber,
      reply
    };
  }

  if (
    !currentSubscriber &&
    ["request", "order", "estimate", "deposit", "manager", "demo", "pilot"].includes(command)
  ) {
    const intentMap = {
      request: "request",
      order: "status",
      estimate: "estimate",
      deposit: "deposit",
      manager: "manager",
      demo: "demo",
      pilot: "pilot"
    };

    return handleClientIntent(intentMap[command], chat, from, currentClientLead);
  }

  const messages = await buildCommandMessages(command, currentSubscriber);
  const replies = [];

  for (const message of messages) {
    replies.push(
      await deliverTelegramMessage(chat?.id, message.text, {
        replyMarkup: message.replyMarkup,
        forcePreview: !isTelegramBotConfigured()
      })
    );
  }

  if (throttledCommands.has(command) && replies.some((item) => item?.mode === "sent")) {
    await markTelegramCommandRun(chat?.id, command);
  }

  return {
    ok: true,
    action: command,
    replies
  };
}

export async function handleTelegramCallbackQuery(callbackQuery) {
  await Promise.all([
    refreshTelegramSubscriberStore(),
    refreshTelegramRegistrationStateStore(),
    refreshTelegramDispatchLogStore()
  ]);

  const data = String(callbackQuery?.data || "");
  const [kind, action, firstArg, secondArg] = data.split("|");
  let result = null;

  if (kind === "reg" && action === "role") {
    const role = normalizeTelegramRole(firstArg);

    if (!role) {
      await acknowledgeTelegramCallback(callbackQuery?.id, "Роль не распознана");
      return {
        ok: false,
        action: "reg",
        result: {
          ok: false,
          message: "Роль не распознана"
        }
      };
    }

    await writePendingRegistration(callbackQuery?.message?.chat?.id, {
      flow: "register",
      role,
      telegramUserId: callbackQuery?.from?.id ? String(callbackQuery.from.id) : null,
      username: callbackQuery?.from?.username || null
    });

    const roleLabel = getTelegramRoleLabel(role);
    await acknowledgeTelegramCallback(callbackQuery?.id, `Роль выбрана: ${roleLabel}`);

    const followupReply = await deliverTelegramMessage(
      callbackQuery?.message?.chat?.id,
      `Роль выбрана: ${roleLabel}.\nТеперь пришли имя одним сообщением, например: Андрей.`,
      {
        forcePreview: !isTelegramBotConfigured()
      }
    );

    return {
      ok: true,
      action: "reg",
      result: {
        ok: true,
        message: `Ожидаю имя для роли ${roleLabel}`
      },
      followupReply
    };
  }

  if (kind === "cl") {
    const chat = callbackQuery?.message?.chat;
    const from = callbackQuery?.from;

    if (action === "menu") {
      const lead = await findLeadForClientChat(chat, from);
      const followupReply = await deliverTelegramMessage(
        chat?.id,
        buildClientHelpText(lead),
        {
          replyMarkup: buildClientMenuKeyboard(lead),
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть Mini App"
        }
      );

      await acknowledgeTelegramCallback(callbackQuery?.id, "Клиентское меню открыто");

      return {
        ok: true,
        action: "client_menu",
        followupReply
      };
    }

    if (action === "apconfirm" && firstArg) {
      result = await updateAppointmentStatus({
        id: firstArg,
        status: "CONFIRMED",
        note: "Подтверждено клиентом через Telegram-бот"
      });

      const lead = await findLeadForClientChat(chat, from);
      const activeAppointment = (lead?.appointments || []).find((item) => item.id === firstArg);
      const messageText = result?.ok
        ? `Замер подтверждён.\n\n${buildClientMeasurementText(lead, activeAppointment)}`
        : result?.message || "Не удалось подтвердить замер.";

      await acknowledgeTelegramCallback(callbackQuery?.id, result?.ok ? "Замер подтверждён" : "Ошибка");

      const followupReply = lead
        ? await sendClientLeadReply(chat?.id, lead, messageText, {
            primarySection: "measurements",
            primaryLabel: "Открыть замер"
          })
        : await deliverTelegramMessage(chat?.id, messageText, {
            replyMarkup: buildClientMenuKeyboard(),
            forcePreview: !isTelegramBotConfigured(),
            appButtonLabel: "Открыть Mini App"
          });

      return {
        ok: Boolean(result?.ok),
        action: "client_apconfirm",
        result,
        followupReply
      };
    }

    const clientIntentMap = {
      request: "request",
      demo: "demo",
      status: "status",
      confirm: "confirm",
      estimate: "estimate",
      deposit: "deposit",
      manager: "manager"
    };

    if (clientIntentMap[action]) {
      await acknowledgeTelegramCallback(callbackQuery?.id, "Открываю");
      return handleClientIntent(clientIntentMap[action], chat, from);
    }
  }

  if (kind === "fu" && action === "done") {
    result = await completeFollowup({
      slug: firstArg,
      typeKey: secondArg,
      note: "Закрыто через Telegram-бот"
    });
  }

  if (kind === "ap" && action && firstArg) {
    result = await updateAppointmentStatus({
      id: firstArg,
      status: action,
      note: "Обновлено через Telegram-бот"
    });
  }

  const messageText = result?.ok
    ? result.message || "Действие выполнено"
    : result?.message || "Не удалось выполнить действие";

  await acknowledgeTelegramCallback(callbackQuery?.id, messageText);

  const followupReply = await deliverTelegramMessage(
    callbackQuery?.message?.chat?.id,
    messageText,
    {
      forcePreview: !isTelegramBotConfigured()
    }
  );

  return {
    ok: Boolean(result?.ok),
    action: kind || "unknown",
    result,
    followupReply
  };
}

export async function handleTelegramWebhookUpdate(update) {
  await Promise.all([
    refreshTelegramSubscriberStore(),
    refreshTelegramRegistrationStateStore(),
    refreshTelegramDispatchLogStore()
  ]);

  if (update?.callback_query) {
    return handleTelegramCallbackQuery(update.callback_query);
  }

  if (update?.message?.text?.startsWith("/")) {
    return handleTelegramCommand(update.message.text, update.message.from, update.message.chat);
  }

  const chatId = update?.message?.chat?.id;
  const messageText = String(update?.message?.text || "").trim();
  const pendingRegistration = readPendingRegistration(chatId);
  const managerSubscriber =
    getPreferredTelegramSubscriber(chatId, "manager") ||
    (pendingRegistration?.role === "manager"
      ? {
          chatId: String(chatId),
          role: "manager",
          name: null,
          username: update?.message?.from?.username || pendingRegistration.username || null,
          telegramUserId:
            update?.message?.from?.id
              ? String(update.message.from.id)
              : pendingRegistration.telegramUserId || null,
          source: "synthetic"
        }
      : null);
  const currentSubscriber = getPreferredTelegramSubscriber(chatId);

  if (
    messageText &&
    (pendingRegistration?.flow?.startsWith("client_") ||
      pendingRegistration?.flow === "pilot_request")
  ) {
    const clientFlowResult = await handleClientPendingFlow(
      messageText,
      update.message.chat,
      update.message.from,
      pendingRegistration
    );

    if (clientFlowResult) {
      return clientFlowResult;
    }
  }

  if (messageText && managerSubscriber) {
    const textIntentResult = await handleTelegramTextIntent(
      messageText,
      update.message.chat,
      managerSubscriber
    );

    if (textIntentResult) {
      return textIntentResult;
    }
  }

  if (
    pendingRegistration?.flow === "register" &&
    pendingRegistration?.role &&
    messageText
  ) {
    const name = messageText;

    if (!name) {
      return {
        ok: true,
        ignored: true,
        message: "Пустое имя для регистрации пропущено."
      };
    }

    const subscriber = {
      chatId: String(update.message.chat.id),
      role: pendingRegistration.role,
      name,
      username: update.message.from?.username || pendingRegistration.username || null,
      telegramUserId:
        update.message.from?.id
          ? String(update.message.from.id)
          : pendingRegistration.telegramUserId || null,
      source: isRuntimeStatePostgresEnabled(getCompanyId()) ? "postgres" : "mock-store"
    };

    await upsertTelegramSubscriber(subscriber);
    await recordRegistrationCompleted({
      telegramUserId: subscriber.telegramUserId,
      chatId: subscriber.chatId,
      username: subscriber.username,
      firstName: subscriber.name,
      languageCode: update.message.from?.language_code || null,
      isPremium: Boolean(update.message.from?.is_premium),
      role: subscriber.role,
      platform: "telegram-bot",
      appVersion: "rc1"
    }).catch(() => null);
    await clearPendingRegistration(update?.message?.chat?.id);

    const reply = await deliverTelegramMessage(
      update?.message?.chat?.id,
      [
        "Чат привязан к роли.",
        `Роль: ${getTelegramRoleLabel(subscriber.role)}`,
        `Имя: ${subscriber.name}`,
        "",
        "Теперь доступны /today, /control, /alerts и /appointments."
      ].join("\n"),
      {
        forcePreview: !isTelegramBotConfigured()
      }
    );

    return {
      ok: true,
      action: "register-name",
      subscriber,
      reply
    };
  }

  if (messageText && !currentSubscriber) {
    const clientIntent = resolveClientTextIntent(messageText);

    if (clientIntent) {
      const clientIntentResult = await handleClientIntent(
        clientIntent,
        update.message.chat,
        update.message.from
      );

      if (clientIntentResult) {
        return clientIntentResult;
      }
    }

    const clientLead = await findLeadForClientChat(update.message.chat, update.message.from);

    return {
      ok: true,
      action: "client_fallback",
      reply: await deliverTelegramMessage(
        update.message.chat?.id,
        buildClientHelpText(clientLead),
        {
          replyMarkup: buildClientMenuKeyboard(clientLead),
          forcePreview: !isTelegramBotConfigured(),
          appButtonLabel: "Открыть Mini App"
        }
      )
    };
  }

  return {
    ok: true,
    ignored: true,
    message: "Поддерживаются команды и callback-действия."
  };
}
