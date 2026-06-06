import { buildLeadHref } from "./lead-links";
import {
  completeFollowup,
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
import { readPersistentJson, writePersistentJson } from "./persistent-store";

const TELEGRAM_SUBSCRIBERS_FILE = "telegram-subscribers.json";
const TELEGRAM_DISPATCH_LOG_FILE = "telegram-dispatch-log.json";
const TELEGRAM_REGISTRATION_STATE_FILE = "telegram-registration-state.json";
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
      subscribers: Array.isArray(INITIAL_TELEGRAM_SUBSCRIBERS)
        ? INITIAL_TELEGRAM_SUBSCRIBERS
        : []
    };
  }

  return globalForTelegramControl.__mebelTelegramControlStore;
}

function normalizeTelegramRole(role) {
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

function buildAbsoluteLeadUrl(slug, section = "summary") {
  const href = buildLeadHref(slug, section);
  return href ? `${getAppBaseUrl()}${href}` : null;
}

function getStoredTelegramSubscribers() {
  const stored = getTelegramControlStore().subscribers;
  return Array.isArray(stored) ? stored : [];
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
  const current = getStoredTelegramSubscribers();
  const next = current.filter(
    (item) =>
      !(String(item.chatId) === String(subscriber.chatId) && item.role === subscriber.role)
  );

  next.push({
    ...subscriber,
    registeredAt: subscriber.registeredAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
  });

  getTelegramControlStore().subscribers = next;
  await writePersistentJson(TELEGRAM_SUBSCRIBERS_FILE, next);
  return subscriber;
}

function getTelegramDispatchLog() {
  const stored = getTelegramControlStore().dispatchLog;
  return stored && typeof stored === "object" ? stored : {};
}

function getTelegramRegistrationState() {
  const stored = getTelegramControlStore().registrationState;
  return stored && typeof stored === "object" ? stored : {};
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

  const nextState = getTelegramRegistrationState();
  nextState[String(chatId)] = {
    ...payload,
    updatedAt: new Date().toISOString()
  };
  await writeTelegramRegistrationState(nextState);
}

async function clearPendingRegistration(chatId) {
  if (!chatId) {
    return;
  }

  const nextState = getTelegramRegistrationState();
  delete nextState[String(chatId)];
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
  log[key] = new Date().toISOString();
  getTelegramControlStore().dispatchLog = log;
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

async function deliverTelegramMessage(chatId, text, options = {}) {
  const payload = {
    text,
    replyMarkup: options.replyMarkup || null
  };

  if (options.forcePreview || !isTelegramBotConfigured()) {
    return {
      ok: true,
      mode: "preview",
      chatId: String(chatId),
      payload
    };
  }

  const result = await sendTelegramBotMessage(chatId, text, {
    disable_web_page_preview: true,
    reply_markup: options.replyMarkup || undefined
  });

  return {
    ok: true,
    mode: "sent",
    chatId: String(chatId),
    messageId: result.message_id,
    payload
  };
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

export function getTelegramControlStatus() {
  return {
    configured: isTelegramBotConfigured(),
    webhookSecretConfigured: Boolean(getTelegramBotSecretToken()),
    subscribers: getTelegramSubscribers().map((item) => ({
      chatId: item.chatId,
      role: item.role,
      roleLabel: getTelegramRoleLabel(item.role),
      name: item.name || null,
      source: item.source || "mock-store"
    }))
  };
}

export async function runTelegramDispatch(options = {}) {
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
    "",
    "Для менеджера можно и без команды:",
    "• какие замеры сегодня",
    "• кого нужно проконсультировать"
  ].join("\n");
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

function resolveTelegramTextIntent(text, subscriber) {
  if (!subscriber || subscriber.role !== "manager") {
    return null;
  }

  const normalized = normalizeLookupText(text);
  const containsAny = (...keywords) => keywords.some((keyword) => normalized.includes(keyword));

  if (!normalized) {
    return null;
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
    case "manager_today_appointments":
      return [buildManagerAppointmentsTextMessage(data, subscriber)];
    case "manager_consultation_queue":
      return [buildManagerConsultationTextMessage(data, subscriber)];
    default:
      return [];
  }
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
  const commandText = String(text || "").trim();
  const [rawCommand, ...rest] = commandText.split(/\s+/);
  const command = rawCommand.replace(/^\//, "").toLowerCase();
  const throttledCommands = new Set(["today", "digest", "control", "alerts", "appointments"]);
  const currentSubscriber =
    getTelegramSubscribers().find((item) => String(item.chatId) === String(chat?.id)) || null;

  if (throttledCommands.has(command) && !canRunTelegramCommand(chat?.id, command, 30)) {
    return {
      ok: true,
      action: command,
      throttled: true,
      message: "Повтор команды подавлен антиспам-защитой."
    };
  }

  if (command === "start" || command === "help") {
    const reply = await deliverTelegramMessage(chat?.id, buildHelpText(currentSubscriber), {
      forcePreview: !isTelegramBotConfigured()
    });

    return {
      ok: true,
      action: "help",
      reply
    };
  }

  if (command === "status") {
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
      source: "mock-store"
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

  if (messageText) {
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
      source: "mock-store"
    };

    await upsertTelegramSubscriber(subscriber);
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

  return {
    ok: true,
    ignored: true,
    message: "Поддерживаются команды и callback-действия."
  };
}
