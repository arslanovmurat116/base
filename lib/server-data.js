import {
  activityLog,
  analyticsSnapshot,
  appointmentsSnapshot,
  dashboardStats,
  escalationSnapshot,
  followupQueue,
  leadStages,
  leadsTable,
  sourceBoard,
  systemModules,
  taskColumns,
  teamQueue,
  workboardSnapshot
} from "./mock-data";
import fs from "node:fs";
import path from "node:path";
import {
  checkDatabaseHealth,
  getDatabaseConfigState,
  getPool,
  isLiveDatabaseEnabled,
  query
} from "./db";
import { sendTelegramBotMessage } from "./telegram";
import { getAILeadReplyDraft } from "./ai-reply-drafts";
import {
  getTelegramReplyTemplateByKey,
  suggestTelegramReplyDraft
} from "./telegram-templates";
import {
  getProjectDocumentSlots,
  getProjectFileSlot,
  getProjectPreviewSlots
} from "./project-file-slots";
import {
  buildPrivateBlobProxyUrl,
  buildProjectFilePathname,
  deletePrivateBlob,
  isBlobStoreEnabled,
  putPrivateBlob,
  readPersistentJson,
  writePersistentJson
} from "./persistent-store";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildStaticDashboardData() {
  const staticAppointments = clone(appointmentsSnapshot);
  const today = new Date();
  const todayCount = staticAppointments.filter((item) => {
    const date = parseBusinessDate(item.scheduledAt, item.scheduledAtIso);
    return date && isSameDay(date, today);
  }).length;
  const confirmedCount = staticAppointments.filter((item) => item.status === "CONFIRMED").length;
  const noShowCount = staticAppointments.filter((item) => item.status === "NO_SHOW").length;
  const revenue = staticAppointments.reduce(
    (sum, item) => sum + getNumericAmount(item.revenueAmount),
    0
  );

  return {
    stats: clone(dashboardStats),
    stages: clone(leadStages),
    queue: clone(teamQueue),
    sources: clone(sourceBoard),
    modules: clone(systemModules),
    appointmentPulse: {
      today: todayCount,
      confirmed: confirmedCount,
      noShow: noShowCount,
      revenue: formatMoneyText(revenue, "0 ₸")
    }
  };
}

function buildStaticWorkboardData() {
  const fallback = clone(workboardSnapshot);
  const urgentLeads = Array.isArray(fallback.urgentLeads) ? fallback.urgentLeads : [];
  const taskQueue = Array.isArray(fallback.taskQueue) ? fallback.taskQueue : [];
  const followups = Array.isArray(fallback.followups) ? fallback.followups : [];
  const alerts = Array.isArray(fallback.alerts) ? fallback.alerts : [];

  return {
    ...fallback,
    urgentLeads: urgentLeads.map((item) => ({
      ...item,
      slug:
        item.slug ||
        findMockLeadSlug(item.lead || item.title || item.note || item.action || item.detail)
    })),
    taskQueue: taskQueue.map((item) => ({
      ...item,
      slug:
        item.slug ||
        findMockLeadSlug(item.lead || item.title || item.note || item.action || item.detail)
    })),
    followups: followups.map((item) => ({
      ...item,
      slug:
        item.slug ||
        findMockLeadSlug(item.lead || item.title || item.note || item.action || item.detail)
    })),
    alerts: alerts.map((item) => ({
      ...item,
      slug:
        item.slug ||
        findMockLeadSlug(item.lead || item.title || item.note || item.action || item.detail)
    }))
  };
}

const globalForDisetCache = globalThis;
const MOCK_STATE_DIR = path.join(process.cwd(), ".mock-state");
const MOCK_LEAD_PATCHES_FILE = path.join(MOCK_STATE_DIR, "lead-patches.json");
const TELEGRAM_CLIENT_LEADS_FILE = "telegram-client-leads.json";
const INITIAL_MOCK_LEAD_PATCHES = await readPersistentJson("lead-patches.json", {});
const INITIAL_TELEGRAM_CLIENT_LEADS = await readPersistentJson(
  TELEGRAM_CLIENT_LEADS_FILE,
  []
);

function getRuntimeCache() {
  if (!globalForDisetCache.__disetRuntimeCache) {
    globalForDisetCache.__disetRuntimeCache = new Map();
  }

  return globalForDisetCache.__disetRuntimeCache;
}

function readRuntimeCache(key, ttlMs) {
  const cache = getRuntimeCache();
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.createdAt > ttlMs) {
    cache.delete(key);
    return null;
  }

  return clone(entry.value);
}

function writeRuntimeCache(key, value) {
  const cache = getRuntimeCache();
  cache.set(key, {
    createdAt: Date.now(),
    value: clone(value)
  });
}

function invalidateRuntimeCache(keys = []) {
  const cache = getRuntimeCache();

  if (!keys.length) {
    cache.clear();
    return;
  }

  for (const key of keys) {
    cache.delete(key);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

  const normalized = raw.toLowerCase();
  const timeMatch = normalized.match(/(\d{1,2}):(\d{2})/);
  const now = new Date();
  const base = new Date(now);

  base.setSeconds(0, 0);
  base.setHours(
    timeMatch ? Number(timeMatch[1]) : 9,
    timeMatch ? Number(timeMatch[2]) : 0,
    0,
    0
  );

  if (normalized.includes("сегодня")) {
    return base;
  }

  if (normalized.includes("завтра")) {
    base.setDate(base.getDate() + 1);
    return base;
  }

  if (normalized.includes("вчера")) {
    base.setDate(base.getDate() - 1);
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

function mergeRecord(baseValue, patchValue) {
  if (!isPlainObject(patchValue)) {
    return clone(patchValue);
  }

  const base = isPlainObject(baseValue) ? clone(baseValue) : {};

  for (const [key, value] of Object.entries(patchValue)) {
    if (value === undefined) {
      continue;
    }

    base[key] = isPlainObject(value) ? mergeRecord(base[key], value) : value;
  }

  return base;
}

function getMockLeadPatches() {
  if (!globalForDisetCache.__disetMockLeadPatches) {
    globalForDisetCache.__disetMockLeadPatches = new Map(
      Object.entries(INITIAL_MOCK_LEAD_PATCHES || {})
    );
  }

  return globalForDisetCache.__disetMockLeadPatches;
}

function getMockExtraLeads() {
  if (!globalForDisetCache.__disetMockExtraLeads) {
    globalForDisetCache.__disetMockExtraLeads = Array.isArray(
      INITIAL_TELEGRAM_CLIENT_LEADS
    )
      ? INITIAL_TELEGRAM_CLIENT_LEADS
      : [];
  }

  return globalForDisetCache.__disetMockExtraLeads;
}

async function persistMockExtraLeads() {
  try {
    await writePersistentJson(TELEGRAM_CLIENT_LEADS_FILE, getMockExtraLeads());
  } catch (error) {
    console.warn("Mock extra lead store write failed:", error.message);
  }
}

async function persistMockLeadPatches() {
  const payload = Object.fromEntries(getMockLeadPatches().entries());

  try {
    await writePersistentJson("lead-patches.json", payload);
  } catch (error) {
    console.warn("Mock lead patch store write failed:", error.message);
  }
}

function readMockLeadPatch(slug) {
  if (!slug) {
    return null;
  }

  const patch = getMockLeadPatches().get(slug);
  return patch ? clone(patch) : null;
}

async function writeMockLeadPatch(slug, patch) {
  if (!slug || !isPlainObject(patch)) {
    return;
  }

  const patches = getMockLeadPatches();
  const current = patches.get(slug) || {};
  patches.set(slug, mergeRecord(current, patch));
  await persistMockLeadPatches();
}

function applyMockLeadPatch(lead) {
  const patch = readMockLeadPatch(lead?.slug || lead?.id);
  return patch ? mergeRecord(lead, patch) : lead;
}

function getMockLeadDataset() {
  return [...clone(leadsTable), ...clone(getMockExtraLeads())].map((lead) =>
    applyMockLeadPatch(lead)
  );
}

export async function reloadMockPersistentState() {
  const nextPatches = await readPersistentJson("lead-patches.json", {});
  const nextExtraLeads = await readPersistentJson(TELEGRAM_CLIENT_LEADS_FILE, []);

  globalForDisetCache.__disetMockLeadPatches = new Map(
    Object.entries(nextPatches || {})
  );
  globalForDisetCache.__disetMockExtraLeads = Array.isArray(nextExtraLeads)
    ? nextExtraLeads
    : [];
  invalidateRuntimeCache();
}

function findMockLeadRecord(reference) {
  const normalized = normalizeLookupText(reference);

  if (!normalized) {
    return null;
  }

  return (
    getMockLeadDataset().find((lead) => {
      const variants = [
        lead.slug,
        lead.id,
        lead.orderNumber,
        lead.name,
        lead.phone,
        lead.telegramUsername,
        lead.telegramChatId,
        lead.telegramUserId
      ]
        .map((value) => normalizeLookupText(value))
        .filter(Boolean);

      return variants.some(
        (variant) =>
          normalized === variant ||
          normalized.includes(variant) ||
          variant.includes(normalized)
      );
    }) || null
  );
}

function findMockLeadByAppointmentId(appointmentId) {
  if (!appointmentId) {
    return null;
  }

  const directMatch = getMockLeadDataset().find((lead) =>
    (lead.appointments || []).some((item) => item.id === appointmentId)
  );

  if (directMatch) {
    return directMatch;
  }

  const snapshotItem = appointmentsSnapshot.find((item) => item.id === appointmentId);

  if (snapshotItem?.slug) {
    return getMockLeadDataset().find((lead) => lead.slug === snapshotItem.slug) || null;
  }

  return snapshotItem?.lead ? findMockLeadRecord(snapshotItem.lead) : null;
}

async function updateMockLeadCollection(slug, collectionKey, updater) {
  if (!slug || typeof updater !== "function") {
    return null;
  }

  const currentLead = getMockLeadDataset().find((lead) => lead.slug === slug);

  if (!currentLead) {
    return null;
  }

  const currentItems = Array.isArray(currentLead[collectionKey])
    ? clone(currentLead[collectionKey])
    : [];
  const nextItems = updater(currentItems);

  if (!Array.isArray(nextItems)) {
    return null;
  }

  await writeMockLeadPatch(slug, {
    [collectionKey]: nextItems
  });

  return nextItems;
}

function buildMockFollowupEntries() {
  const merged = new Map(
    clone(followupQueue).map((item, index) => [
      item.id || `${item.slug || "lead"}-followup-${index + 1}`,
      {
        ...item,
        id: item.id || `${item.slug || "lead"}-followup-${index + 1}`,
        typeKey: item.typeKey || inferFollowupTypeKey(item.type),
        scheduledAtIso: item.scheduledAtIso || null
      }
    ])
  );

  for (const lead of getMockLeadDataset()) {
    for (const [index, item] of (lead.followups || []).entries()) {
      const id = item.id || `${lead.slug}-followup-${index + 1}`;
      const existing = merged.get(id) || {};

      merged.set(id, {
        ...existing,
        ...item,
        id,
        slug: item.slug || lead.slug,
        lead: item.lead || lead.name,
        owner: item.owner || lead.manager || existing.owner || "Не назначен",
        type: item.type || existing.type || formatFollowupTypeLabel(item.typeKey || "custom"),
        typeKey: item.typeKey || existing.typeKey || inferFollowupTypeKey(item.type),
        scheduledAt: item.scheduledAt || existing.scheduledAt || "Не назначено",
        scheduledAtIso: item.scheduledAtIso || existing.scheduledAtIso || null,
        note: item.note || existing.note || "Комментарий не добавлен",
        status: item.status || existing.status || "PENDING"
      });
    }
  }

  return Array.from(merged.values());
}

function buildMockAppointmentEntries() {
  const merged = new Map(
    clone(appointmentsSnapshot).map((item) => [
      item.id,
      normalizeMeasurementRecord(item)
    ])
  );

  for (const lead of getMockLeadDataset()) {
    for (const item of lead.appointments || []) {
      if (!item?.id) {
        continue;
      }

      const existing = merged.get(item.id) || {};
      merged.set(
        item.id,
        normalizeMeasurementRecord({
          ...existing,
          ...item,
          slug: item.slug || lead.slug || existing.slug,
          lead: item.lead || lead.name || existing.lead,
          owner: item.owner || lead.manager || existing.owner || "Не назначен"
        })
      );
    }
  }

  return Array.from(merged.values());
}

function createMockAppointmentId() {
  const numericIds = [
    ...appointmentsSnapshot,
    ...buildMockAppointmentEntries()
  ]
    .map((item) => String(item?.id || "").match(/(\d+)/))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  const nextNumber = numericIds.length ? Math.max(...numericIds) + 1 : 501;
  return `A-${nextNumber}`;
}

function getCompanyId() {
  return process.env.DISET_DEFAULT_COMPANY_ID;
}

async function logLeadEvent(
  companyId,
  leadId,
  eventType,
  payload = {},
  executor = query
) {
  if (!companyId || !leadId) {
    return;
  }

  await executor(
    `
      insert into lead_events (
        company_id,
        lead_id,
        event_type,
        payload
      )
      values ($1, $2, $3, $4::jsonb)
    `,
    [companyId, leadId, eventType, JSON.stringify(payload)]
  );
}

function normalizeLeadStatus(status) {
  return status || "NEW";
}

function formatFollowupTypeLabel(type) {
  switch (type) {
    case "booking_confirmation":
      return "Подтвердить запись";
    case "reschedule":
      return "Подобрать новый слот";
    case "booking_push":
      return "Дожать до записи";
    case "proposal_followup":
      return "Вернуться после предложения";
    case "estimate_prep":
      return "Подготовить расчёт";
    case "budget_followup":
      return "Уточнить бюджет";
    case "call_confirmation":
      return "Подтвердить созвон";
    case "call_nurture":
      return "Вернуться после письменного ответа";
    case "call_reschedule":
      return "Подобрать новый слот созвона";
    case "example_followup":
      return "Отправить пример решения";
    case "case_followup":
      return "Показать кейс и вернуться";
    case "soft_followup":
      return "Мягко вернуться позже";
    case "proposal":
      return "Вернуться после предложения";
    case "call":
      return "Созвониться повторно";
    case "message":
      return "Написать повторно";
    case "custom":
      return "Следующий контакт";
    default:
      return type || "Следующий контакт";
  }
}

function inferFollowupTypeKey(type) {
  const normalized = normalizeLookupText(type);

  if (!normalized) {
    return "custom";
  }

  if (
    normalized.includes("booking confirmation") ||
    normalized.includes("подтвердить запись") ||
    normalized.includes("подтверждение записи") ||
    normalized.includes("подтверждение выезда")
  ) {
    return "booking_confirmation";
  }

  if (
    normalized.includes("reschedule") ||
    normalized.includes("новый слот") ||
    normalized.includes("перенос")
  ) {
    return "reschedule";
  }

  if (
    normalized.includes("booking push") ||
    normalized.includes("дожать до записи")
  ) {
    return "booking_push";
  }

  if (
    normalized.includes("proposal followup") ||
    normalized.includes("после расч") ||
    normalized.includes("после предлож") ||
    normalized.includes("вернуться после предложения")
  ) {
    return "proposal_followup";
  }

  if (
    normalized.includes("estimate prep") ||
    normalized.includes("подготовить расч") ||
    normalized.includes("собрать расч")
  ) {
    return "estimate_prep";
  }

  if (
    normalized.includes("budget followup") ||
    normalized.includes("дожим") ||
    normalized.includes("бюджет")
  ) {
    return "budget_followup";
  }

  if (
    normalized.includes("call confirmation") ||
    normalized.includes("подтвердить созвон")
  ) {
    return "call_confirmation";
  }

  if (
    normalized.includes("call nurture") ||
    normalized.includes("письменн")
  ) {
    return "call_nurture";
  }

  if (
    normalized.includes("call reschedule") ||
    normalized.includes("созвон") ||
    normalized.includes("созвониться")
  ) {
    return "call_reschedule";
  }

  if (
    normalized.includes("example followup") ||
    normalized.includes("пример")
  ) {
    return "example_followup";
  }

  if (normalized.includes("case followup") || normalized.includes("кейс")) {
    return "case_followup";
  }

  if (normalized.includes("soft followup") || normalized.includes("мягко")) {
    return "soft_followup";
  }

  if (normalized === "call") {
    return "call";
  }

  if (normalized === "message") {
    return "message";
  }

  return type && /^[a-z_]+$/i.test(String(type)) ? String(type) : "custom";
}

const LEAD_STATUS_LABELS = {
  NEW: "Новая заявка",
  CONTACTED: "Связаться",
  QUALIFIED: "Расчёт стоимости",
  MEETING: "Замер назначен",
  PROPOSAL: "Согласование",
  WON: "Предоплата получена",
  LOST: "Отказ"
};

const APPOINTMENT_STATUS_LABELS = {
  SCHEDULED: "Назначено",
  CONFIRMED: "Подтверждено",
  COMPLETED: "Проведено",
  CANCELLED: "Отменено",
  NO_SHOW: "Не состоялось"
};

const APPOINTMENT_TYPE_LABELS = {
  measurement: "Замер",
  showroom: "Шоурум",
  consultation: "Консультация",
  call: "Созвон",
  custom: "Другое"
};

function getLeadStatusLabel(status) {
  return LEAD_STATUS_LABELS[normalizeLeadStatus(status)] || status || "Не указан";
}

function getAppointmentStatusLabel(status) {
  return APPOINTMENT_STATUS_LABELS[status] || status || "Не указан";
}

function getAppointmentTypeLabel(type) {
  return APPOINTMENT_TYPE_LABELS[type] || type || "Другое";
}

function getNumericAmount(value) {
  if (value == null || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");

  const amount = Number(normalized);

  if (Number.isFinite(amount)) {
    return amount;
  }

  const lower = String(value).toLowerCase();
  const multiplier = lower.includes("млн")
    ? 1_000_000
    : lower.includes("тыс")
      ? 1_000
      : 1;
  const matches = String(value).match(/\d+(?:[.,]\d+)?/g) || [];

  if (!matches.length) {
    return 0;
  }

  const firstCandidate = Number(matches[0].replace(",", ".")) * multiplier;
  return Number.isFinite(firstCandidate) ? firstCandidate : 0;
}

function hasAmount(value) {
  return getNumericAmount(value) > 0;
}

function formatMoneyText(value, fallback = "Не указано") {
  if (value == null || value === "") {
    return fallback;
  }

  if (typeof value === "string" && value.includes("₸")) {
    return value;
  }

  const amount = getNumericAmount(value);

  if (!amount) {
    return fallback;
  }

  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0
  }).format(amount)} ₸`;
}

function formatUrgencyLabel(value) {
  switch (String(value || "").toLowerCase()) {
    case "hot":
    case "горячий":
      return "Срочно";
    case "warm":
    case "тёплый":
    case "теплый":
      return "Планово";
    case "cold":
    case "холодный":
      return "Низкий приоритет";
    case "закрыта":
      return "Завершена";
    default:
      return value || "Обычная";
  }
}

function getPrimaryAppointment(appointments = []) {
  if (!appointments.length) {
    return null;
  }

  return (
    appointments.find((item) => item.status === "COMPLETED") ||
    appointments.find((item) => ["CONFIRMED", "SCHEDULED"].includes(item.status)) ||
    appointments[0]
  );
}

function deriveMeasurementStatus(lead, appointments = []) {
  if (lead.measurement?.status) {
    return lead.measurement.status;
  }

  const primaryAppointment = getPrimaryAppointment(appointments);

  if (primaryAppointment?.status === "COMPLETED") {
    return "Замер выполнен";
  }

  if (primaryAppointment && ["CONFIRMED", "SCHEDULED"].includes(primaryAppointment.status)) {
    return "Замер назначен";
  }

  if (lead.status === "MEETING") {
    return "Назначить замер";
  }

  return "Не назначен";
}

function deriveDealStage(lead, appointments = []) {
  if (lead.dealStage) {
    return lead.dealStage;
  }

  const measurementStatus = deriveMeasurementStatus(lead, appointments);

  switch (lead.status) {
    case "NEW":
      return "Новая заявка";
    case "CONTACTED":
      return "Связаться";
    case "QUALIFIED":
      return "Расчёт стоимости";
    case "MEETING":
      return measurementStatus === "Замер выполнен"
        ? "Замер выполнен"
        : "Замер назначен";
    case "PROPOSAL":
      return "Согласование";
    case "WON":
      return hasAmount(lead.prepaymentAmount)
        ? "Предоплата получена"
        : lead.productionStatus || "В производство";
    case "LOST":
      return "Отказ";
    default:
      return "Сделка в работе";
  }
}

function deriveCalculationStatus(lead, appointments = []) {
  if (lead.calculationStatus) {
    return lead.calculationStatus;
  }

  if (lead.status === "NEW" || lead.status === "CONTACTED") {
    return "Не начинали";
  }

  if (lead.status === "QUALIFIED") {
    return "В расчёте";
  }

  if (
    lead.status === "MEETING" &&
    deriveMeasurementStatus(lead, appointments) === "Замер выполнен"
  ) {
    return "Ожидает расчёта после замера";
  }

  if (lead.status === "PROPOSAL" || lead.status === "WON") {
    return "Расчёт отправлен";
  }

  if (lead.status === "LOST") {
    return "Остановлен";
  }

  return "Уточняется";
}

function derivePrepaymentStatus(lead) {
  if (lead.prepaymentStatus) {
    return lead.prepaymentStatus;
  }

  if (hasAmount(lead.prepaymentAmount) || lead.status === "WON") {
    return "Предоплата получена";
  }

  if (["PROPOSAL", "MEETING", "QUALIFIED"].includes(lead.status)) {
    return "Ожидаем предоплату";
  }

  return "Не запрошена";
}

function normalizeMeasurementRecord(record = {}) {
  const typeLabel = record.typeLabel || getAppointmentTypeLabel(record.type);
  const statusLabel = record.statusLabel || getAppointmentStatusLabel(record.status);
  const measurementStatus =
    record.measurementStatus ||
    (record.status === "COMPLETED"
      ? "Замер выполнен"
      : ["SCHEDULED", "CONFIRMED"].includes(record.status)
        ? "Замер назначен"
        : record.status === "NO_SHOW"
          ? "Замер сорван"
          : statusLabel);

  return {
    ...record,
    slug: record.slug || findMockLeadSlug(record.lead),
    typeLabel,
    statusLabel,
    address: record.address || record.location || "Адрес уточняется",
    measurer: record.measurer || record.owner || "Не назначен",
    measurementStatus,
    dimensionsSummary:
      record.dimensionsSummary || "Размеры будут добавлены после замера",
    measurementComment:
      record.measurementComment ||
      record.note ||
      "Комментарий замерщика пока не добавлен",
    measurementResult:
      record.measurementResult ||
      record.outcomeNote ||
      (record.status === "COMPLETED"
        ? "Замер выполнен, сделка готова к следующему шагу."
        : "Результат замера ещё не зафиксирован."),
    prepaymentAmount:
      record.prepaymentAmount || formatMoneyText(record.revenueAmount, "")
  };
}

function deriveProjectStatus({ lead, measurementStatus, calculationStatus, dealStage }) {
  if (lead.project?.status) {
    return lead.project.status;
  }

  if (lead.status === "WON") {
    return "Проект утверждён";
  }

  if (dealStage === "Согласование") {
    return "Проект на согласовании";
  }

  if (measurementStatus === "Замер выполнен") {
    return "Размеры собраны, проект в работе";
  }

  if (measurementStatus === "Замер назначен") {
    return "Ждёт замер";
  }

  if (calculationStatus === "В расчёте") {
    return "Собираем проект";
  }

  if (calculationStatus === "Расчёт отправлен") {
    return "Проект передан клиенту";
  }

  return "Черновик";
}

function inferFallbackOrderItems(lead, dimensionsText, productionStatus) {
  const lowerProduct = String(lead.product || "").toLowerCase();
  const baseItem = {
    material: "Материал уточняется в расчёте",
    facade: "Фасады уточняются",
    hardware: "Фурнитура уточняется",
    quantity: 1,
    amount: "Входит в общий расчёт",
    status: productionStatus || "Не запущено"
  };
  const items = [];

  if (lowerProduct.includes("кухн")) {
    items.push({
      zone: "Кухня",
      title: "Основной кухонный гарнитур",
      dimensions: dimensionsText,
      ...baseItem
    });
  }

  if (lowerProduct.includes("постироч")) {
    items.push({
      zone: "Постирочная",
      title: "Шкафы и хранение для постирочной",
      dimensions: dimensionsText,
      ...baseItem
    });
  }

  if (lowerProduct.includes("гардероб")) {
    items.push({
      zone: "Гардеробная",
      title: "Система хранения",
      dimensions: dimensionsText,
      ...baseItem
    });
  }

  if (lowerProduct.includes("шкаф")) {
    items.push({
      zone: lowerProduct.includes("прихож") ? "Прихожая" : lead.projectSize || "Зона шкафа",
      title: lowerProduct.includes("шкаф-купе") ? "Шкаф-купе" : "Встроенный шкаф",
      dimensions: dimensionsText,
      ...baseItem
    });
  }

  if (lowerProduct.includes("тумб")) {
    items.push({
      zone: "Зона тумбы",
      title: "Тумба / модуль хранения",
      dimensions: dimensionsText,
      ...baseItem
    });
  }

  if (lowerProduct.includes("тв")) {
    items.push({
      zone: "Гостиная",
      title: "ТВ-зона",
      dimensions: dimensionsText,
      ...baseItem
    });
  }

  if (lowerProduct.includes("офис")) {
    items.push(
      {
        zone: "Ресепшен",
        title: "Стойка ресепшен",
        dimensions: dimensionsText,
        ...baseItem
      },
      {
        zone: "Офис",
        title: "Шкафы и тумбы для сотрудников",
        dimensions: dimensionsText,
        ...baseItem
      }
    );
  }

  if (!items.length) {
    items.push({
      zone: lead.projectSize || "Основная зона",
      title: lead.product || "Изделие",
      dimensions: dimensionsText,
      ...baseItem
    });
  }

  return items;
}

const DEMO_PROJECTS_DIR = path.join(process.cwd(), "public", "demo-projects");
const PROJECT_FILES_DIR = path.join(process.cwd(), "public", "project-files");

function formatFileTimestamp(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.statSync(filePath).mtime.toLocaleString("ru-RU");
  } catch {
    return null;
  }
}

function sanitizeProjectFileSlug(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function directoryHasFiles(directoryPath) {
  try {
    return fs.existsSync(directoryPath) && fs.readdirSync(directoryPath).length > 0;
  } catch {
    return false;
  }
}

function parseProjectSheetsValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (value == null) {
    return [];
  }

  return String(value)
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeProjectAssetMeta(source = {}) {
  if (!isPlainObject(source)) {
    return {};
  }

  const estimateSource = isPlainObject(source.estimate) ? source.estimate : {};
  const result = {};

  for (const key of ["version", "exportedAt", "uploadedBy", "actuality", "sourceProgram"]) {
    if (hasOwn(source, key)) {
      const value = String(source[key] ?? "").trim();

      if (value) {
        result[key] = value;
      }
    }
  }

  const sheets = parseProjectSheetsValue(estimateSource.sheets);
  const estimate = {};

  for (const key of ["version", "exportedAt", "uploadedBy", "actuality", "sourceLabel"]) {
    if (hasOwn(estimateSource, key)) {
      const value = String(estimateSource[key] ?? "").trim();

      if (value) {
        estimate[key] = value;
      }
    }
  }

  if (sheets.length) {
    estimate.sheets = sheets;
  }

  if (Object.keys(estimate).length) {
    result.estimate = estimate;
  }

  const storedFilesSource = isPlainObject(source.storedFiles) ? source.storedFiles : {};
  const storedFiles = {};

  for (const [slotId, item] of Object.entries(storedFilesSource)) {
    if (item == null) {
      storedFiles[slotId] = null;
      continue;
    }

    if (!isPlainObject(item)) {
      continue;
    }

    const pathname = String(item.pathname ?? "").trim();

    if (!pathname) {
      continue;
    }

    storedFiles[slotId] = {
      pathname,
      fileName: String(item.fileName ?? "").trim() || pathname.split("/").pop() || slotId,
      contentType: String(item.contentType ?? "").trim() || null,
      updatedAt: String(item.updatedAt ?? "").trim() || null
    };
  }

  if (Object.keys(storedFiles).length) {
    result.storedFiles = storedFiles;
  }

  return result;
}

function findStoredProjectAsset(slot, directories = []) {
  for (const directory of directories) {
    if (!directory?.rootPath || !fs.existsSync(directory.rootPath)) {
      continue;
    }

    const exactNames = Array.isArray(slot.fallbackFileNames) ? slot.fallbackFileNames : [];

    for (const fileName of exactNames) {
      const absolutePath = path.join(directory.rootPath, fileName);

      if (fs.existsSync(absolutePath)) {
        return {
          absolutePath,
          fileName,
          publicBase: directory.publicBase
        };
      }
    }

    const candidates = fs
      .readdirSync(directory.rootPath)
      .filter((fileName) =>
        fileName.toLowerCase().startsWith(`${String(slot.baseName || "").toLowerCase()}.`)
      )
      .sort();

    if (candidates.length) {
      return {
        absolutePath: path.join(directory.rootPath, candidates[0]),
        fileName: candidates[0],
        publicBase: directory.publicBase
      };
    }
  }

  return null;
}

function buildLeadProjectAssets(lead, projectPreparedAt) {
  const slug = sanitizeProjectFileSlug(lead?.slug || lead?.id || "");
  const defaultExportDate = projectPreparedAt || lead.lastTouch || lead.createdAt || "Не указано";
  const demoDirectory = {
    rootPath: path.join(DEMO_PROJECTS_DIR, slug),
    publicBase: `/demo-projects/${slug}`
  };
  const uploadedDirectory = {
    rootPath: path.join(PROJECT_FILES_DIR, slug),
    publicBase: `/project-files/${slug}`
  };
  const metadata = sanitizeProjectAssetMeta(lead.projectAssets || lead.project?.assets || {});
  const storedFiles = isPlainObject(metadata.storedFiles) ? metadata.storedFiles : {};
  const directories = [uploadedDirectory, demoDirectory];
  const hasDemoAssets = directoryHasFiles(demoDirectory.rootPath);
  const buildFile = (slot) => {
    const stored = isPlainObject(storedFiles[slot.id]) ? storedFiles[slot.id] : null;

    if (stored?.pathname) {
      return {
        id: slot.id,
        title: slot.title,
        type: slot.type,
        note: slot.note,
        preview: Boolean(slot.preview),
        required: Boolean(slot.required),
        available: true,
        fileName: stored.fileName || slot.fallbackFileNames?.[0] || `${slot.baseName}`,
        url: buildPrivateBlobProxyUrl(stored.pathname),
        updatedAt: stored.updatedAt || defaultExportDate
      };
    }

    const match = findStoredProjectAsset(slot, directories);

    return {
      id: slot.id,
      title: slot.title,
      type: slot.type,
      note: slot.note,
      preview: Boolean(slot.preview),
      required: Boolean(slot.required),
      available: Boolean(match),
      fileName: match?.fileName || slot.fallbackFileNames?.[0] || `${slot.baseName}`,
      url: match ? `${match.publicBase}/${match.fileName}` : null,
      updatedAt: match ? formatFileTimestamp(match.absolutePath) : null
    };
  };

  const previewFiles = getProjectPreviewSlots().map(buildFile);
  const previews = previewFiles.filter((item) => item.available);
  const files = getProjectDocumentSlots().map(buildFile);
  const estimateFile = files.find((item) => item.id === "estimate-excel");
  const estimatePreview = previewFiles.find((item) => item.id === "estimate-preview");
  const sourceFile = files.find((item) => item.id === "source-project");
  const anyFilesAttached = [...previewFiles, ...files].some((item) => item.available);
  const estimateSheets = metadata.estimate?.sheets?.length
    ? metadata.estimate.sheets
    : hasDemoAssets
      ? ["Data", "Sum"]
      : [];
  const estimateAttached = Boolean(estimateFile?.available);
  const estimatePreviewAttached = Boolean(estimatePreview?.available);
  const exportedAt =
    anyFilesAttached
      ? metadata.exportedAt ||
        estimateFile?.updatedAt ||
        sourceFile?.updatedAt ||
        defaultExportDate
      : defaultExportDate;
  const uploadedBy = anyFilesAttached
    ? metadata.uploadedBy || (hasDemoAssets ? "Проектировщик" : lead.manager || "Не указано")
    : lead.manager || "Не указано";
  const version = anyFilesAttached
    ? metadata.version || "Экспорт v1"
    : "Черновик";
  const sourceProgram = anyFilesAttached
    ? metadata.sourceProgram ||
      (hasDemoAssets ? "SketchUp + Excel" : "Внешняя проектная программа")
    : "Внешняя проектная программа";
  const actuality = anyFilesAttached
    ? metadata.actuality || "Актуально"
    : "Файлы пока не прикреплены";

  return {
    version,
    exportedAt,
    uploadedBy,
    actuality,
    sourceProgram,
    previews,
    files,
    estimate: {
      version:
        estimateAttached || estimatePreviewAttached
          ? metadata.estimate?.version || version
          : "Черновик",
      exportedAt:
        estimateAttached || estimatePreviewAttached
          ? metadata.estimate?.exportedAt || exportedAt
          : defaultExportDate,
      uploadedBy:
        estimateAttached || estimatePreviewAttached
          ? metadata.estimate?.uploadedBy || uploadedBy
          : lead.manager || "Не указано",
      actuality: estimateAttached
        ? metadata.estimate?.actuality || "Актуальная смета"
        : "Смета ещё не прикреплена",
      sourceLabel: estimateAttached
        ? metadata.estimate?.sourceLabel || estimateFile?.title || "Смета Excel (.xlsx)"
        : "Файл сметы пока не добавлен",
      fileUrl: estimateFile?.url || null,
      previewUrl: estimatePreview?.url || null,
      sheets: estimateAttached ? estimateSheets : []
    }
  };
}

function buildProjectAndOrder(lead, context) {
  const {
    address,
    clientComment,
    calculationStatus,
    dealStage,
    finalAmount,
    managerComment,
    measurementStatus,
    prepaymentAmount,
    prepaymentStatus,
    primaryAppointment,
    productionStatus
  } = context;
  const inferProjectColor = () => {
    if (lead.project?.color) {
      return lead.project.color;
    }

    const hint = `${clientComment} ${managerComment}`.toLowerCase();

    if (hint.includes("светл")) {
      return "Светлая палитра";
    }

    if (hint.includes("тёмн")) {
      return "Тёмная палитра";
    }

    if (hint.includes("бел")) {
      return "Белый";
    }

    if (hint.includes("дерев")) {
      return "Древесный оттенок";
    }

    return "Цвет уточняется";
  };
  const dimensionsText =
    lead.measurement?.dimensions ||
    primaryAppointment?.dimensionsSummary ||
    "Размеры будут добавлены после замера";
  const measurementsSource =
    lead.project?.measurementsSource ||
    (measurementStatus === "Замер выполнен"
      ? "Фактический замер на объекте"
      : measurementStatus === "Замер назначен"
        ? "Предварительные данные до выезда"
        : "План клиента или первичный бриф");
  const fallbackItems = inferFallbackOrderItems(lead, dimensionsText, productionStatus);
  const rawItems =
    (Array.isArray(lead.order?.items) && lead.order.items.length
      ? lead.order.items
      : Array.isArray(lead.orderItems) && lead.orderItems.length
        ? lead.orderItems
        : fallbackItems);
  const orderItems = rawItems.map((item, index) => ({
    id: item.id || `${lead.id || lead.slug || "lead"}-item-${index + 1}`,
    zone: item.zone || lead.projectSize || "Основная зона",
    title: item.title || item.name || lead.product || "Изделие",
    dimensions: item.dimensions || dimensionsText,
    material: item.material || "Материал уточняется в расчёте",
    facade: item.facade || "Фасады уточняются",
    hardware: item.hardware || "Фурнитура уточняется",
    quantity: item.quantity || item.qty || 1,
    amount: item.amount || "Входит в общий расчёт",
    status: item.status || productionStatus || "Не запущено"
  }));
  const zoneText = lead.project?.zones ||
    (orderItems.length
      ? orderItems.map((item) => item.zone).join(", ")
      : lead.projectSize || "Не указаны");
  const projectPreparedAt =
    lead.project?.preparedAt ||
    (["В расчёте", "Расчёт отправлен", "Расчёт согласован"].includes(calculationStatus)
      ? lead.lastTouch || lead.createdAt || "Дата не указана"
      : "Ещё не подготовлен");
  const projectStatus = deriveProjectStatus({
    lead,
    measurementStatus,
    calculationStatus,
    dealStage
  });
  const finalPaymentStatus =
    lead.order?.production?.finalPaymentStatus ||
    lead.calculation?.finalPaymentStatus ||
    (lead.status === "WON" && productionStatus === "Завершено"
      ? "Оплачено полностью"
      : prepaymentStatus === "Предоплата получена"
        ? "Ждём окончательную оплату"
        : "Финальная оплата не запрошена");
  const preliminaryAmount =
    lead.calculation?.preliminaryAmount ||
    lead.order?.preliminaryAmount ||
    lead.estimateRange ||
    lead.budget ||
    "Уточняется";
  const finalAmountText = finalAmount || "Уточняется";
  const finalAmountValue = getNumericAmount(finalAmount);
  const preliminaryAmountValue = getNumericAmount(preliminaryAmount);
  const prepaymentValue = getNumericAmount(prepaymentAmount);
  const projectAssets = buildLeadProjectAssets(lead, projectPreparedAt);
  const balanceDue =
    lead.calculation?.balanceDue ||
    lead.order?.balanceDue ||
    (finalPaymentStatus === "Оплачено полностью"
      ? "0 ₸"
      : finalAmountValue > 0
        ? formatMoneyText(Math.max(finalAmountValue - prepaymentValue, 0), "0 ₸")
        : "Уточняется после финального расчёта");
  const handedToProduction =
    typeof lead.order?.production?.handedToProduction === "boolean"
      ? lead.order.production.handedToProduction
      : productionStatus !== "Не запущено" || lead.status === "WON";
  const productionStage =
    lead.order?.production?.stage ||
    (lead.order?.production?.installationStatus === "Установка завершена"
      ? "Завершено"
      : lead.order?.production?.installationStatus === "В установке"
        ? "Установка"
        : lead.order?.production?.installationStatus === "Готово к монтажу"
          ? "Готово к установке"
          : handedToProduction
            ? "Ожидает распил"
            : "Не передано");
  const stageOwner =
    lead.order?.production?.stageOwner ||
    lead.installation?.installer ||
    lead.project?.measurer ||
    lead.manager ||
    "Не назначен";
  const productionDeadline =
    lead.order?.production?.deadline ||
    lead.productionDeadline ||
    lead.nextContactAt ||
    "Не назначен";
  const productionComment =
    lead.order?.production?.comment ||
    lead.productionComment ||
    lead.measurement?.result ||
    managerComment ||
    "Комментарий производства пока не добавлен";
  const installationStatus =
    lead.installation?.status ||
    lead.order?.installation?.status ||
    (productionStage === "Завершено"
      ? "Установка завершена"
      : productionStage === "Установка"
        ? "В установке"
        : productionStage === "Готово к установке"
          ? "Готово к монтажу"
          : "Не назначена");
  const installation = {
    date:
      lead.installation?.date ||
      lead.order?.installation?.date ||
      (installationStatus === "Установка завершена" ? lead.lastTouch || "Дата не указана" : "Не назначена"),
    address:
      lead.installation?.address ||
      lead.order?.installation?.address ||
      address,
    installer:
      lead.installation?.installer ||
      lead.order?.installation?.installer ||
      stageOwner,
    status: installationStatus,
    comment:
      lead.installation?.comment ||
      lead.order?.installation?.comment ||
      (installationStatus === "Не назначена"
        ? "Монтаж ещё не запланирован"
        : "Комментарий по установке пока не добавлен")
  };
  const project = {
    status: projectStatus,
    designStatus:
      lead.project?.designStatus ||
      (calculationStatus === "Расчёт согласован"
        ? "Проект согласован"
        : calculationStatus === "Расчёт отправлен"
          ? "Проект отправлен клиенту"
          : calculationStatus === "В расчёте"
            ? "Эскиз и смета в работе"
            : measurementStatus === "Замер выполнен"
              ? "После замера собираем проект"
              : "Проект ещё не собран"),
    description:
      lead.project?.description ||
      `${lead.product || "Изделие"}: ${lead.projectSize || lead.requestType || "состав проекта уточняется"}`,
    layout: lead.project?.layout || lead.projectSize || "Состав проекта уточняется",
    zones: zoneText,
    measurements: lead.project?.measurements || dimensionsText,
    measurementsSource,
    materials: lead.project?.materials || "Материалы подбираются после расчёта",
    facades: lead.project?.facades || "Фасады ещё не утверждены",
    hardware: lead.project?.hardware || "Фурнитура ещё не утверждена",
    color: inferProjectColor(),
    designerComment:
      lead.project?.designerComment ||
      lead.project?.notes ||
      managerComment ||
      "Комментарий проектировщика пока не добавлен",
    preparedAt: projectPreparedAt,
    measurer:
      lead.project?.measurer ||
      lead.measurement?.measurer ||
      primaryAppointment?.measurer ||
      lead.manager ||
      "Не назначен",
    address,
    notes: lead.project?.notes || managerComment || clientComment,
    result:
      lead.project?.result ||
      lead.measurement?.result ||
      primaryAppointment?.measurementResult ||
      "Проект ещё не переведён в рабочую спецификацию",
    assets: projectAssets
  };
  const order = {
    orderCode: lead.order?.orderCode || `ORD-${lead.id || lead.slug || "TEMP"}`,
    status: lead.order?.status || dealStage,
    items: orderItems,
    itemsCount: orderItems.length,
    preliminaryAmount,
    estimateRange: lead.order?.estimateRange || lead.estimateRange || "Уточняется",
    prepaymentAmount: formatMoneyText(prepaymentAmount, "Не внесена"),
    finalAmount: finalAmountText,
    balanceDue,
    calculation: {
      preliminaryAmount,
      finalAmount: finalAmountText,
      prepaymentAmount: formatMoneyText(prepaymentAmount, "Не внесена"),
      balanceDue,
      prepaymentStatus,
      finalPaymentStatus
    },
    production: {
      overall: lead.order?.production?.overall || productionStatus || "Не запущено",
      handedToProduction,
      handoverDate:
        lead.order?.production?.handoverDate ||
        (handedToProduction ? lead.lastTouch || lead.createdAt || "Дата не указана" : "Не передано"),
      stage: productionStage,
      projectStatus: lead.order?.production?.projectStatus || project.designStatus,
      cuttingStatus:
        lead.order?.production?.cuttingStatus ||
        (productionStatus === "В производство" ? "Очередь на распил" : "Не запущено"),
      assemblyStatus:
        lead.order?.production?.assemblyStatus ||
        (productionStatus === "В производство" ? "Сборка не начата" : "Не запущено"),
      installationStatus:
        lead.order?.production?.installationStatus ||
        installationStatus,
      finalPaymentStatus,
      stageOwner,
      deadline: productionDeadline,
      comment: productionComment
    },
    installation
  };
  const estimateBaseValue = finalAmountValue || preliminaryAmountValue;
  const explicitEstimateTotal = orderItems.reduce(
    (sum, item) => sum + getNumericAmount(item.amount),
    0
  );
  const fallbackLineValue =
    !explicitEstimateTotal && estimateBaseValue > 0 && orderItems.length
      ? estimateBaseValue / orderItems.length
      : 0;
  const estimateItems = orderItems.map((item) => {
    const quantityValue = Number(item.quantity || 1) || 1;
    const explicitValue = getNumericAmount(item.amount);
    const resolvedValue = explicitValue || fallbackLineValue;

    return {
      id: `${item.id}-estimate`,
      zone: item.zone,
      title: item.title,
      quantity: quantityValue,
      dimensions: item.dimensions,
      material: item.material,
      facade: item.facade,
      hardware: item.hardware,
      unitPrice:
        resolvedValue > 0
          ? formatMoneyText(resolvedValue / quantityValue, "Уточняется")
          : "Уточняется",
      amount:
        explicitValue > 0
          ? formatMoneyText(explicitValue, item.amount || "Уточняется")
          : resolvedValue > 0
            ? formatMoneyText(resolvedValue, item.amount || "Уточняется")
            : item.amount || "Уточняется",
      status: item.status || calculationStatus || "Черновик",
      note: [item.material, item.facade, item.hardware]
        .filter(Boolean)
        .join(" • ")
    };
  });
  const estimateItemsTotal =
    estimateItems.reduce((sum, item) => sum + getNumericAmount(item.amount), 0) ||
    estimateBaseValue;
  order.estimate = {
    status: calculationStatus || "Уточняется",
    versionLabel:
      finalAmountValue > 0 ? "Финальная смета" : "Предварительная смета",
    preparedAt: projectPreparedAt,
    items: estimateItems,
    itemsCount: estimateItems.length,
    subtotal: formatMoneyText(
      estimateItemsTotal,
      preliminaryAmount || "Уточняется"
    ),
    preliminaryAmount,
    finalAmount: finalAmountText,
    prepaymentAmount: formatMoneyText(prepaymentAmount, "Не внесена"),
    balanceDue,
    note:
      calculationStatus === "Расчёт согласован"
        ? "Смета готова к договору и переходу к предоплате."
        : calculationStatus === "Расчёт отправлен"
          ? "Смета уже у клиента, важно дожать следующий контакт."
          : calculationStatus === "В расчёте"
            ? "Смета в работе: уточняем материалы, размеры и итоговую сумму."
            : "Смета ещё собирается из замера, состава заказа и пожеланий клиента.",
    paymentPlan: [
      {
        title: "Предоплата",
        amount: formatMoneyText(prepaymentAmount, "Не запрошена"),
        status: prepaymentStatus || "Не запрошена",
        note:
          prepaymentValue > 0
            ? "Фиксируем старт заказа и резерв материалов."
            : "Ждём подтверждения клиента по стартовому платежу."
      },
      {
        title: "Остаток",
        amount: balanceDue,
        status: finalPaymentStatus || "Не запрошена",
        note: handedToProduction
          ? "Закрывается перед установкой или сразу после монтажа."
          : "Финальная оплата идёт после согласования и запуска заказа."
      }
    ],
    export: projectAssets.estimate
  };

  return {
    project,
    order,
    projectAssets
  };
}

function buildFurnitureLead(lead = {}) {
  const appointments = (lead.appointments || []).map((item) =>
    normalizeMeasurementRecord(item)
  );
  const primaryAppointment = getPrimaryAppointment(appointments);
  const pendingFollowup = (lead.followups || []).find(
    (item) => String(item.status) === "PENDING"
  );
  const address = lead.address || primaryAppointment?.address || lead.city || "Адрес уточняется";
  const createdAt = lead.createdAt || lead.lastTouch || "Дата не указана";
  const nextContactAt =
    lead.nextContactAt || pendingFollowup?.scheduledAt || lead.deadline || "Не назначен";
  const clientComment =
    lead.clientComment || lead.summary || "Комментарий клиента пока не зафиксирован";
  const urgency = lead.urgency || formatUrgencyLabel(lead.temperature);
  const measurementStatus = deriveMeasurementStatus(lead, appointments);
  const dealStage = deriveDealStage(lead, appointments);
  const calculationStatus = deriveCalculationStatus(lead, appointments);
  const prepaymentStatus = derivePrepaymentStatus(lead);
  const prepaymentAmount = lead.prepaymentAmount || "";
  const finalAmount = lead.finalAmount || lead.estimateRange || "";
  const managerComment = lead.managerComment || "";
  const productionStatus =
    lead.productionStatus || (lead.status === "WON" ? "Готово к запуску" : "Не запущено");
  const { project, order, projectAssets } = buildProjectAndOrder(lead, {
    address,
    clientComment,
    calculationStatus,
    dealStage,
    finalAmount,
    managerComment,
    measurementStatus,
    prepaymentAmount,
    prepaymentStatus,
    primaryAppointment,
    productionStatus
  });

  return {
    ...lead,
    statusLabel: getLeadStatusLabel(lead.status),
    dealStage,
    address,
    createdAt,
    nextContactAt,
    urgency,
    clientComment,
    calculationStatus,
    prepaymentStatus,
    prepaymentAmount,
    finalAmount,
    productionStatus,
    measurementStatus,
    appointments,
    project,
    projectAssets,
    order,
    measurement: {
      date: lead.measurement?.date || primaryAppointment?.scheduledAt || "Не назначен",
      time: lead.measurement?.time || primaryAppointment?.scheduledAt || "Не назначено",
      address: lead.measurement?.address || address,
      measurer:
        lead.measurement?.measurer ||
        primaryAppointment?.measurer ||
        lead.manager ||
        "Не назначен",
      status: lead.measurement?.status || measurementStatus,
      dimensions:
        lead.measurement?.dimensions ||
        primaryAppointment?.dimensionsSummary ||
        "Размеры будут добавлены после замера",
      comment:
        lead.measurement?.comment ||
        primaryAppointment?.measurementComment ||
        "Комментарий замерщика пока не добавлен",
      result:
        lead.measurement?.result ||
        primaryAppointment?.measurementResult ||
        "Результат замера ещё не зафиксирован"
    },
    client: {
      name: lead.name || "Клиент без имени",
      phone: lead.phone || "Не указан",
      address,
      source: lead.source || "Не указан",
      comment: clientComment,
      createdAt
    },
    deal: {
      productType: lead.product || "Не указано",
      status: dealStage,
      budget: lead.budget || "Уточняется",
      urgency,
      responsible: lead.manager || "Не назначен",
      nextStep: lead.nextAction || "Не зафиксирован",
      nextContactAt,
      prepaymentAmount: formatMoneyText(prepaymentAmount, "Не внесена"),
      finalAmount: finalAmount || "Уточняется",
      comments: managerComment ? [managerComment] : [],
      calculationStatus,
      prepaymentStatus,
      productionStatus
    },
    postMeasurementCard: {
      client: lead.name || "Клиент без имени",
      contacts: lead.phone || "Не указан",
      address,
      furnitureType: lead.product || "Не указано",
      dimensions:
        lead.measurement?.dimensions ||
        primaryAppointment?.dimensionsSummary ||
        "Размеры будут добавлены после замера",
      wishes: clientComment,
      budget: lead.budget || "Уточняется",
      calculationStatus,
      prepaymentStatus,
      nextStep: lead.nextAction || "Не зафиксирован",
      history: lead.activity || [],
      comments: managerComment ? [managerComment] : [],
      project,
      order,
      cost: {
        preliminaryAmount: order.calculation?.preliminaryAmount || order.preliminaryAmount,
        estimateRange: lead.estimateRange || "Уточняется",
        prepaymentAmount: formatMoneyText(prepaymentAmount, "Не внесена"),
        finalAmount: order.calculation?.finalAmount || order.finalAmount || finalAmount || "Уточняется",
        balanceDue: order.calculation?.balanceDue || order.balanceDue || "Уточняется"
      },
      production: order.production,
      installation: order.installation,
      calculation: order.calculation
    }
  };
}

function normalizeTaskColumn(title, items, tone) {
  return { title, items, tone };
}

function flattenTaskColumns(columns) {
  return columns.flatMap((column) =>
    column.items.map((item) => ({
      lane: column.title,
      tone: column.tone,
      ...item
    }))
  );
}

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-zР°-СЏС‘0-9]+/gi, " ")
    .trim();
}

function findMockLeadSlug(name) {
  const normalized = normalizeLookupText(name);

  if (!normalized) {
    return null;
  }

  const exactMatch = getMockLeadDataset().find((lead) => {
    const leadName = normalizeLookupText(lead.name);
    return normalized.includes(leadName) || leadName.includes(normalized);
  });

  if (exactMatch) {
    return exactMatch.slug;
  }

  const tokens = normalized.split(" ").filter((token) => token.length >= 4);

  if (!tokens.length) {
    return null;
  }

  const partialMatch = getMockLeadDataset().find((lead) => {
    const leadTokens = normalizeLookupText(lead.name)
      .split(" ")
      .filter((token) => token.length >= 4);

    return tokens.some((token) =>
      leadTokens.some((leadToken) => {
        const tokenStem = token.slice(0, 5);
        const leadStem = leadToken.slice(0, 5);
        return (
          leadToken.includes(token) ||
          token.includes(leadToken) ||
          (tokenStem.length >= 4 && leadToken.includes(tokenStem)) ||
          (leadStem.length >= 4 && token.includes(leadStem))
        );
      })
    );
  });

  return partialMatch?.slug || null;
}

function getNextMockLeadSequence() {
  return getMockLeadDataset().reduce((highest, lead) => {
    const rawValue = String(lead?.id || lead?.slug || "");
    const match = rawValue.match(/(\d{3,})/);
    const numeric = match ? Number(match[1]) : 0;
    return Number.isFinite(numeric) && numeric > highest ? numeric : highest;
  }, 200) + 1;
}

function formatMockBusinessDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildTelegramClientLeadRecord(payload = {}) {
  const sequence = getNextMockLeadSequence();
  const slug = `l-${sequence}`;
  const id = `L-${sequence}`;
  const now = new Date();
  const followupDate = new Date(now.getTime() + 45 * 60 * 1000);
  const product = payload.product?.trim() || "Другое изделие";
  const clientNote = payload.note?.trim() || "Клиент оставил заявку через Telegram-бот.";
  const name = payload.name?.trim() || "Клиент Telegram";
  const phone = payload.phone?.trim() || "Не указан";
  const username = payload.username ? `@${String(payload.username).replace(/^@+/, "")}` : null;
  const shortSource = username || "Telegram-бот";
  const activityTime = formatMockBusinessDate(now);
  const nextContactAt = formatMockBusinessDate(followupDate);

  return {
    id,
    slug,
    orderNumber: `FRNQ-${sequence}`,
    name,
    phone,
    channel: "Telegram",
    source: "Telegram бот",
    manager: "Не назначен",
    status: "NEW",
    nextAction: "Связаться с клиентом и уточнить состав заказа",
    deadline: nextContactAt,
    summary: clientNote,
    product,
    requestType: product,
    projectSize: "Уточняется после консультации",
    city: "Уточняется",
    address: "Адрес уточняется после первичного контакта",
    createdAt: activityTime,
    urgency: "Обычная",
    temperature: "Тёплый",
    budget: "Уточняется",
    estimateRange: "После брифа и замера",
    dealStage: "Новая заявка",
    calculationStatus: "Не начинали",
    prepaymentStatus: "Не запрошена",
    prepaymentAmount: "",
    finalAmount: "",
    productionStatus: "Не запущено",
    nextContactAt,
    lastTouch: activityTime,
    clientComment: clientNote,
    managerComment: "Заявка создана клиентом через Telegram-бот.",
    telegramChatId: payload.chatId ? String(payload.chatId) : null,
    telegramUserId: payload.telegramUserId ? String(payload.telegramUserId) : null,
    telegramUsername: username,
    measurement: {
      date: "Не назначен",
      time: "Не назначено",
      address: "Адрес уточняется после первичного контакта",
      measurer: "Не назначен",
      status: "Не назначен",
      dimensions: "Размеры будут добавлены после замера",
      comment: "Клиент ещё не прошёл замер.",
      result: "Замер ещё не назначен"
    },
    tags: ["Telegram", product],
    messages: [
      {
        direction: "inbound",
        sender: "Клиент",
        text: clientNote,
        time: new Date(now).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit"
        })
      },
      {
        direction: "system",
        sender: "Система",
        text: "Заявка создана из клиентского режима Telegram-бота.",
        time: new Date(now).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit"
        })
      }
    ],
    tasks: [
      {
        title: "Связаться с клиентом и уточнить детали заказа",
        description: `Клиент пришёл из Telegram. Изделие: ${product}. Нужно уточнить состав заказа, бюджет и удобное время для замера.`,
        owner: "Не назначен",
        priority: "high",
        dueAt: nextContactAt,
        status: "OPEN"
      }
    ],
    followups: [],
    appointments: [],
    statusHistory: [
      {
        previousStatus: "—",
        nextStatus: "NEW",
        time: activityTime,
        reason: "Заявка создана клиентом через Telegram-бот",
        actor: "Система"
      }
    ],
    activity: [
      {
        action: "Заявка создана",
        time: activityTime,
        actor: "Telegram-бот",
        detail: `Источник: ${shortSource}. Изделие: ${product}.`
      }
    ],
    intakeSession: {
      requestTrack: "telegram_client",
      summaryText: clientNote
    }
  };
}

function findMockLeadByTelegramClientReference({
  chatId = null,
  telegramUserId = null,
  username = null,
  reference = null
} = {}) {
  const dataset = [...getMockLeadDataset()].reverse();

  const linkedLead =
    dataset.find(
      (lead) =>
        (chatId && String(lead.telegramChatId || "") === String(chatId)) ||
        (telegramUserId &&
          String(lead.telegramUserId || "") === String(telegramUserId)) ||
        (username &&
          normalizeLookupText(lead.telegramUsername) ===
            normalizeLookupText(`@${String(username).replace(/^@+/, "")}`))
    ) || null;

  if (linkedLead) {
    return linkedLead;
  }

  return reference ? findMockLeadRecord(reference) : null;
}

function formatLeadEventDetail(eventType, payload = {}) {
  const note = payload.executor_note ? ` Комментарий: ${payload.executor_note}` : "";

  switch (eventType) {
    case "lead_created":
      return `Заявка создана из источника ${payload.source || "не указан"} через канал ${payload.channel || "не указан"}.`;
    case "manager_assigned":
      return "Сделка назначена ответственному менеджеру.";
    case "telegram_message_received":
      return "Новое сообщение Telegram сохранено в историю.";
    case "first_contact_task_created":
      return "Создана задача на первый контакт с клиентом.";
    case "safe_auto_reply_sent":
      return "Клиенту отправлен безопасный автоответ в Telegram.";
    case "bot_context_reply_sent":
      return `Система отправила ответ в Telegram.${payload.intent ? ` Сценарий: ${payload.intent}.` : ""}${payload.source_message ? ` Основание: ${payload.source_message}` : ""}`;
    case "lead_intake_started":
      return `Стартовал сценарий приёма заявки. Текущий шаг: ${payload.step || "не указан"}.`;
    case "lead_intake_progressed":
      return `Бриф продвинут. Закрыт шаг: ${payload.answered_step || "не указан"}, следующий: ${payload.next_step || "не указан"}.`;
    case "lead_intake_completed":
      return `Мини-бриф заполнен.${payload.summary_text ? ` Итог: ${payload.summary_text}` : ""}`;
    case "task_created":
      return `Создана задача: ${payload.title || "без названия"}.${payload.description ? ` Что сделать: ${payload.description}` : ""}`;
    case "task_completed":
      return `Задача выполнена: ${payload.title || "без названия"}.${note}`;
    case "followup_created":
      return `Создан следующий контакт: ${formatFollowupTypeLabel(payload.followup_type)} на ${payload.scheduled_at || "время не указано"}.${payload.note ? ` Комментарий: ${payload.note}` : ""}`;
    case "followup_completed":
      return `Следующий контакт выполнен: ${formatFollowupTypeLabel(payload.followup_type)}.${note}`;
    case "manager_outcome_logged":
      return `Менеджер зафиксировал итог контакта: ${payload.outcome || "не указан"}, новый этап ${getLeadStatusLabel(payload.next_status)}.${payload.note ? ` Комментарий: ${payload.note}` : ""}${payload.next_action ? ` Следующий шаг: ${payload.next_action}` : ""}${payload.followup_at ? ` Вернуться: ${payload.followup_at}` : ""}`;
    case "manager_reply_sent":
      return `Менеджер отправил сообщение клиенту.${payload.message_text ? ` Текст: ${payload.message_text}` : ""}`;
    case "appointment_created":
      return `Создан замер или встреча: ${getAppointmentTypeLabel(payload.appointment_type)} на ${payload.scheduled_at || "время не указано"}.${payload.location ? ` Адрес: ${payload.location}.` : ""}${payload.note ? ` Комментарий: ${payload.note}` : ""}`;
    case "appointment_status_updated":
      return `Статус замера обновлён: ${getAppointmentStatusLabel(payload.status)}.${payload.note ? ` Комментарий: ${payload.note}` : ""}`;
    case "appointment_reminder_sent":
      return `Отправлено напоминание по замеру.${payload.message_text ? ` Текст: ${payload.message_text}` : ""}`;
    case "appointment_template_sent":
      return `Отправлен шаблон сообщения по замеру: ${payload.template_key || "не указан"}.${payload.message_text ? ` Текст: ${payload.message_text}` : ""}`;
    case "appointment_followthrough_logged":
      return `Зафиксирован результат выезда: ${getAppointmentStatusLabel(payload.status)}.${payload.revenue_amount ? ` Предоплата: ${formatMoneyText(payload.revenue_amount)}.` : ""}${payload.note ? ` Комментарий: ${payload.note}` : ""}`;
    case "lead_workflow_updated":
      return `Сделка переведена из этапа ${getLeadStatusLabel(payload.previous_status)} в ${getLeadStatusLabel(payload.next_status)}.${payload.next_action ? ` Следующий шаг: ${payload.next_action}` : ""}`;
    case "lead_order_context_updated":
      return `Обновлены блоки карточки заказа: ${formatLeadContextSectionLabels(payload.updated_sections)}.`;
    case "lead_lost_reason_saved":
      return `Причина отказа сохранена: ${payload.loss_reason || "не указана"}.`;
    case "first_response_reminder_sent":
      return "Отправлено напоминание: просрочен первый контакт по заявке.";
    default:
      return payload && Object.keys(payload).length
        ? JSON.stringify(payload)
        : "Без деталей";
  }
}

function formatLeadEventAction(eventType) {
  switch (eventType) {
    case "lead_created":
      return "Заявка создана";
    case "manager_assigned":
      return "Назначен менеджер";
    case "telegram_message_received":
      return "Сообщение Telegram";
    case "first_contact_task_created":
      return "Первый контакт";
    case "safe_auto_reply_sent":
      return "Автоответ";
    case "bot_context_reply_sent":
      return "Ответ системы";
    case "lead_intake_started":
      return "Старт приёма";
    case "lead_intake_progressed":
      return "Бриф обновлён";
    case "lead_intake_completed":
      return "Бриф заполнен";
    case "task_created":
      return "Задача создана";
    case "task_completed":
      return "Задача выполнена";
    case "followup_created":
      return "Следующий контакт создан";
    case "followup_completed":
      return "Следующий контакт выполнен";
    case "manager_outcome_logged":
      return "Итог контакта";
    case "manager_reply_sent":
      return "Ответ менеджера";
    case "appointment_created":
      return "Замер создан";
    case "appointment_status_updated":
      return "Статус замера";
    case "appointment_reminder_sent":
      return "Напоминание по замеру";
    case "appointment_template_sent":
      return "Шаблон по замеру";
    case "appointment_followthrough_logged":
      return "Результат замера";
    case "lead_workflow_updated":
      return "Этап сделки обновлён";
    case "lead_order_context_updated":
      return "Карточка заказа обновлена";
    case "lead_lost_reason_saved":
      return "Причина отказа";
    case "first_response_reminder_sent":
      return "Напоминание по сроку";
    default:
      return eventType;
  }
}

const LEAD_CONTEXT_SECTION_LABELS = {
  project: "проект",
  calculation: "расчёт",
  order_items: "состав заказа",
  production: "производство",
  installation: "установка"
};

function formatLeadContextSectionLabels(sections = []) {
  const labels = sections
    .map((item) => LEAD_CONTEXT_SECTION_LABELS[item] || item)
    .filter(Boolean);

  return labels.length ? labels.join(", ") : "рабочие данные";
}

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function sanitizeStringSection(source, fields) {
  if (!isPlainObject(source)) {
    return null;
  }

  const result = {};
  let hasValues = false;

  for (const field of fields) {
    if (!hasOwn(source, field)) {
      continue;
    }

    result[field] = String(source[field] ?? "").trim();
    hasValues = true;
  }

  return hasValues ? result : null;
}

function sanitizeOrderItemsSection(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((item, index) => {
      if (!isPlainObject(item)) {
        return null;
      }

      const title = String(item.title ?? "").trim();
      const zone = String(item.zone ?? "").trim();
      const dimensions = String(item.dimensions ?? "").trim();
      const material = String(item.material ?? "").trim();
      const facade = String(item.facade ?? "").trim();
      const hardware = String(item.hardware ?? "").trim();
      const amount = String(item.amount ?? "").trim();
      const status = String(item.status ?? "").trim();
      const id = String(item.id ?? "").trim() || `custom-item-${index + 1}`;
      const quantityValue = Number.parseInt(String(item.quantity ?? "").trim(), 10);
      const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;

      if (
        !title &&
        !zone &&
        !dimensions &&
        !material &&
        !facade &&
        !hardware &&
        !amount &&
        !status
      ) {
        return null;
      }

      return {
        id,
        title: title || `Позиция ${index + 1}`,
        zone: zone || "Зона уточняется",
        quantity,
        dimensions: dimensions || "Размеры уточняются",
        material: material || "Материал уточняется",
        facade: facade || "Фасады уточняются",
        hardware: hardware || "Фурнитура уточняется",
        amount: amount || "Уточняется",
        status: status || "Черновик"
      };
    })
    .filter(Boolean);
}

function normalizeProductionStageStatus(stage, handedToProduction) {
  switch (stage) {
    case "Ожидает распил":
    case "Распил":
    case "Сборка":
      return "В производство";
    case "Готово к установке":
      return "Готово к установке";
    case "Установка":
      return "В установке";
    case "Завершено":
      return "Завершено";
    default:
      return handedToProduction ? "В производство" : "Не запущено";
  }
}

function buildLeadContextPatch(payload = {}) {
  const projectPatch = sanitizeStringSection(payload.project, [
    "status",
    "description",
    "materials",
    "hardware",
    "color",
    "designerComment",
    "preparedAt"
  ]);
  const calculationPatch = sanitizeStringSection(payload.calculation, [
    "preliminaryAmount",
    "finalAmount",
    "prepaymentAmount",
    "balanceDue",
    "prepaymentStatus",
    "finalPaymentStatus"
  ]);
  let productionPatch = sanitizeStringSection(payload.production, [
    "handoverDate",
    "stage",
    "stageOwner",
    "deadline",
    "comment"
  ]);
  const installationPatch = sanitizeStringSection(payload.installation, [
    "date",
    "address",
    "installer",
    "status",
    "comment"
  ]);
  const orderItemsProvided =
    Array.isArray(payload.orderItems) ||
    (isPlainObject(payload.order) && Array.isArray(payload.order.items));
  const orderItemsPatch = orderItemsProvided
    ? sanitizeOrderItemsSection(
        Array.isArray(payload.orderItems) ? payload.orderItems : payload.order.items
      )
    : null;
  const handedToProductionProvided = hasOwn(payload.production, "handedToProduction");

  if (handedToProductionProvided) {
    productionPatch = {
      ...(productionPatch || {}),
      handedToProduction: Boolean(payload.production.handedToProduction)
    };
  }

  const sections = [];
  let leadPatch = {};

  if (projectPatch) {
    sections.push("project");
    leadPatch = mergeRecord(leadPatch, {
      project: {
        ...projectPatch,
        notes: projectPatch.designerComment || undefined
      }
    });
  }

  if (calculationPatch) {
    sections.push("calculation");
    leadPatch = mergeRecord(leadPatch, {
      prepaymentAmount: calculationPatch.prepaymentAmount,
      prepaymentStatus: calculationPatch.prepaymentStatus,
      finalAmount: calculationPatch.finalAmount,
      estimateRange: calculationPatch.preliminaryAmount,
      order: {
        preliminaryAmount: calculationPatch.preliminaryAmount,
        prepaymentAmount: calculationPatch.prepaymentAmount,
        finalAmount: calculationPatch.finalAmount,
        balanceDue: calculationPatch.balanceDue,
        calculation: calculationPatch,
        production: {
          finalPaymentStatus: calculationPatch.finalPaymentStatus
        }
      }
    });
  }

  if (orderItemsProvided) {
    sections.push("order_items");
    leadPatch = mergeRecord(leadPatch, {
      orderItems: orderItemsPatch,
      order: {
        items: orderItemsPatch
      }
    });
  }

  if (productionPatch) {
    sections.push("production");
    const handedToProduction = Boolean(productionPatch.handedToProduction);
    const stage = productionPatch.stage || "";

    leadPatch = mergeRecord(leadPatch, {
      productionStatus:
        hasOwn(productionPatch, "handedToProduction") || stage
          ? normalizeProductionStageStatus(stage, handedToProduction)
          : undefined,
      order: {
        production: {
          ...productionPatch
        }
      }
    });
  }

  if (installationPatch) {
    sections.push("installation");
    leadPatch = mergeRecord(leadPatch, {
      installation: installationPatch,
      order: {
        installation: installationPatch,
        production: {
          installationStatus: installationPatch.status
        }
      }
    });
  }

  if (projectPatch?.status) {
    leadPatch = mergeRecord(leadPatch, {
      order: {
        production: {
          projectStatus: projectPatch.status
        }
      }
    });
  }

  return sections.length ? { patch: leadPatch, sections } : null;
}

function applyLeadContextEvents(lead, rows = []) {
  return [...rows]
    .reverse()
    .filter((row) => row.event_type === "lead_order_context_updated")
    .reduce((currentLead, row) => {
      const patch = row.payload?.context_patch;
      return isPlainObject(patch) ? mergeRecord(currentLead, patch) : currentLead;
    }, lead);
}

function getProjectUploadExtension(fileName, slot) {
  const extension = path.extname(String(fileName || "")).toLowerCase();

  if (/^\.[a-z0-9]{1,8}$/.test(extension)) {
    return extension;
  }

  switch (slot?.type) {
    case "pdf":
      return ".pdf";
    case "estimate":
      return ".xlsx";
    case "source":
      return ".skp";
    default:
      return ".jpg";
  }
}

function isProjectUploadTypeAllowed(uploadedFile, slot) {
  const allowedTokens = String(slot?.accept || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedTokens.length) {
    return true;
  }

  const fileName = String(uploadedFile?.name || "").trim().toLowerCase();
  const mimeType = String(uploadedFile?.type || "").trim().toLowerCase();
  const extension = path.extname(fileName).toLowerCase();

  return allowedTokens.some((token) => {
    if (token === "image/*") {
      return mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension);
    }

    if (token.startsWith(".")) {
      return extension === token;
    }

    return mimeType === token;
  });
}

function getProjectUploadAllowedLabel(slot) {
  return String(slot?.accept || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function removeStoredProjectSlotFiles(directoryPath, slot) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  const lowerBaseName = String(slot.baseName || "").toLowerCase();
  const lowerFallbackNames = new Set(
    (slot.fallbackFileNames || []).map((fileName) => String(fileName || "").toLowerCase())
  );

  for (const fileName of fs.readdirSync(directoryPath)) {
    const lowerFileName = fileName.toLowerCase();

    if (
      lowerFallbackNames.has(lowerFileName) ||
      lowerFileName.startsWith(`${lowerBaseName}.`)
    ) {
      fs.rmSync(path.join(directoryPath, fileName), { force: true });
    }
  }
}

function buildProjectAssetUploadPatch(slot, metadata = {}, storedFile = null) {
  const exportedAt = metadata.exportedAt || new Date().toLocaleString("ru-RU");
  const uploadedBy = metadata.uploadedBy || "Не указано";
  const version = metadata.version || "Экспорт v1";
  const actuality = metadata.actuality || "Актуально";
  const sourceProgram = metadata.sourceProgram || "Внешняя проектная программа";
  const leadPatch = {
    project: {
      preparedAt: exportedAt
    },
    projectAssets: {
      version,
      exportedAt,
      uploadedBy,
      actuality,
      sourceProgram
    }
  };

  if (slot.id === "estimate-excel" || slot.id === "estimate-preview") {
    const sheets = parseProjectSheetsValue(metadata.sheets);
    leadPatch.projectAssets.estimate = {
      version,
      exportedAt,
      uploadedBy,
      actuality: slot.id === "estimate-excel" ? "Актуальная смета" : actuality,
      sourceLabel: slot.id === "estimate-excel" ? slot.title : undefined,
      sheets
    };
  }

  if (storedFile?.pathname) {
    leadPatch.projectAssets.storedFiles = {
      [slot.id]: {
        pathname: storedFile.pathname,
        fileName: storedFile.fileName || slot.fallbackFileNames?.[0] || `${slot.baseName}`,
        contentType: storedFile.contentType || null,
        updatedAt: storedFile.updatedAt || exportedAt
      }
    };
  }

  return leadPatch;
}

export async function uploadLeadProjectAsset(slug, formData) {
  const lead = await getLeadBySlug(slug);

  if (!lead) {
    return {
      ok: false,
      status: 404,
      message: "Сделка не найдена"
    };
  }

  const slotId = String(formData.get("slot") ?? "").trim();
  const slot = getProjectFileSlot(slotId);

  if (!slot) {
    return {
      ok: false,
      message: "Нужно выбрать тип проектного файла"
    };
  }

  const uploadedFile = formData.get("file");

  if (!uploadedFile || typeof uploadedFile.arrayBuffer !== "function") {
    return {
      ok: false,
      message: "Нужно приложить файл"
    };
  }

  const fileName = String(uploadedFile.name || "").trim();
  const buffer = Buffer.from(await uploadedFile.arrayBuffer());

  if (!buffer.length) {
    return {
      ok: false,
      message: "Файл пустой или не считался"
    };
  }

  if (!isProjectUploadTypeAllowed(uploadedFile, slot)) {
    return {
      ok: false,
      message: `Неверный формат для слота «${slot.title}». Разрешено: ${getProjectUploadAllowedLabel(slot)}`
    };
  }

  const safeSlug = sanitizeProjectFileSlug(slug);

  if (!safeSlug) {
    return {
      ok: false,
      message: "Некорректный идентификатор сделки"
    };
  }

  const storedFileName = `${slot.baseName}${getProjectUploadExtension(fileName, slot)}`;
  const storedAt = new Date().toLocaleString("ru-RU");
  const blobPathname = buildProjectFilePathname(safeSlug, storedFileName);

  if (isBlobStoreEnabled()) {
    await deletePrivateBlob(blobPathname).catch(() => null);
    await putPrivateBlob(
      blobPathname,
      buffer,
      uploadedFile.type || "application/octet-stream"
    );
  } else {
    const directoryPath = path.join(PROJECT_FILES_DIR, safeSlug);
    fs.mkdirSync(directoryPath, { recursive: true });
    removeStoredProjectSlotFiles(directoryPath, slot);
    fs.writeFileSync(path.join(directoryPath, storedFileName), buffer);
  }

  const metadata = {
    version: String(formData.get("version") ?? "").trim(),
    exportedAt: String(formData.get("exportedAt") ?? "").trim(),
    uploadedBy: String(formData.get("uploadedBy") ?? "").trim(),
    actuality: String(formData.get("actuality") ?? "").trim(),
    sourceProgram: String(formData.get("sourceProgram") ?? "").trim(),
    sheets: String(formData.get("sheets") ?? "").trim()
  };
  const projectAssetsPatch = buildProjectAssetUploadPatch(slot, metadata, {
    pathname: blobPathname,
    fileName: storedFileName,
    contentType: uploadedFile.type || "application/octet-stream",
    updatedAt: storedAt
  });

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      await logLeadEvent(getCompanyId(), slug, "lead_order_context_updated", {
        updated_sections: ["project_assets"],
        context_patch: projectAssetsPatch,
        uploaded_slot: slot.id,
        uploaded_file_name: storedFileName
      });

      invalidateRuntimeCache();

      return {
        ok: true,
        mode: "live",
        message: `Файл прикреплён: ${slot.title}`
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Не удалось сохранить файл в live-режиме: ${error.message}`
      };
    }
  }

  await writeMockLeadPatch(slug, projectAssetsPatch);
  invalidateRuntimeCache();

  return {
    ok: true,
    mode: "mock",
    message: `Файл прикреплён: ${slot.title}`,
    preview: {
      slug,
      slot: slot.id,
      storedFileName
    }
  };
}

export async function deleteLeadProjectAsset(slug, payload = {}) {
  const lead = await getLeadBySlug(slug);

  if (!lead) {
    return {
      ok: false,
      status: 404,
      message: "Сделка не найдена"
    };
  }

  const slotId = String(payload.slot || "").trim();
  const slot = getProjectFileSlot(slotId);

  if (!slot) {
    return {
      ok: false,
      message: "Нужно выбрать файл, который удаляем"
    };
  }

  const safeSlug = sanitizeProjectFileSlug(slug);
  const metadata = sanitizeProjectAssetMeta(lead.projectAssets || lead.project?.assets || {});
  const storedFiles = isPlainObject(metadata.storedFiles) ? metadata.storedFiles : {};
  const storedFile = isPlainObject(storedFiles[slot.id]) ? storedFiles[slot.id] : null;

  if (storedFile?.pathname && isBlobStoreEnabled()) {
    await deletePrivateBlob(storedFile.pathname).catch(() => null);
  } else {
    const directoryPath = path.join(PROJECT_FILES_DIR, safeSlug);

    if (!fs.existsSync(directoryPath)) {
      return {
        ok: false,
        message: "Для этой сделки ещё нет загруженных файлов"
      };
    }

    const beforeFiles = fs.readdirSync(directoryPath).length;
    removeStoredProjectSlotFiles(directoryPath, slot);
    const afterFiles = fs.existsSync(directoryPath) ? fs.readdirSync(directoryPath).length : 0;

    if (beforeFiles === afterFiles) {
      return {
        ok: false,
        message: "Для выбранного слота нет загруженного файла"
      };
    }

    if (afterFiles === 0) {
      fs.rmSync(directoryPath, { recursive: true, force: true });
    }
  }

  const deletePatch = {
    projectAssets: {
      storedFiles: {
        [slot.id]: null
      }
    }
  };

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      await logLeadEvent(getCompanyId(), slug, "lead_order_context_updated", {
        updated_sections: ["project_assets"],
        context_patch: deletePatch,
        deleted_slot: slot.id
      });

      invalidateRuntimeCache();

      return {
        ok: true,
        mode: "live",
        message: `Файл удалён: ${slot.title}`
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Не удалось удалить файл в live-режиме: ${error.message}`
      };
    }
  }

  await writeMockLeadPatch(slug, deletePatch);
  invalidateRuntimeCache();

  return {
    ok: true,
    mode: "mock",
    message: `Файл удалён: ${slot.title}`,
    preview: {
      slug,
      slot: slot.id
    }
  };
}

export function getLeadStatusOptions() {
  return [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "MEETING",
    "PROPOSAL",
    "WON",
    "LOST"
  ];
}

function normalizeOutcomeStatus(outcome) {
  switch (outcome) {
    case "replied":
    case "awaiting_response":
      return "CONTACTED";
    case "qualified":
      return "QUALIFIED";
    case "meeting_booked":
      return "MEETING";
    case "proposal_sent":
      return "PROPOSAL";
    case "won":
      return "WON";
    case "lost":
      return "LOST";
    default:
      return "CONTACTED";
  }
}

const TRACK_OUTCOME_AUTOMATION = {
  booking: {
    meeting_booked: {
      nextAction: "Подтвердить слот и отправить напоминание",
      followupHours: 12,
      followupType: "booking_confirmation",
      followupNote: "Проверить подтверждение записи и напоминание",
      taskTitle: "Подтвердить запись",
      taskDescription: "Связаться с клиентом, подтвердить слот и убедиться, что напоминание отправлено."
    },
    awaiting_response: {
      nextAction: "Предложить 2-3 новых времени для записи",
      followupHours: 24,
      followupType: "reschedule",
      followupNote: "Вернуться с новыми слотами для записи"
    },
    replied: {
      nextAction: "Дожать до конкретной записи",
      followupHours: 24,
      followupType: "booking_push",
      followupNote: "Вернуться и закрепить запись"
    }
  },
  estimate: {
    proposal_sent: {
      nextAction: "Вернуться после отправки предложения",
      followupHours: 24,
      followupType: "proposal_followup",
      followupNote: "Проверить реакцию на предложение"
    },
    qualified: {
      nextAction: "Подготовить расчёт первого этапа",
      followupHours: 12,
      followupType: "estimate_prep",
      followupNote: "Подготовить расчёт и вернуться к клиенту",
      taskTitle: "Подготовить расчёт",
      taskDescription: "Собрать рамку первого этапа и подготовить расчёт для клиента."
    },
    awaiting_response: {
      nextAction: "Уточнить бюджет и объём работ",
      followupHours: 24,
      followupType: "budget_followup",
      followupNote: "Вернуться с уточнением по бюджету"
    }
  },
  consultation: {
    meeting_booked: {
      nextAction: "Отправить рамку созвона",
      followupHours: 6,
      followupType: "call_confirmation",
      followupNote: "Подтвердить слот созвона и отправить рамку",
      taskTitle: "Подготовить созвон",
      taskDescription: "Отправить клиенту рамку разговора и подтвердить слот созвона."
    },
    replied: {
      nextAction: "Объяснить решение письменно и довести до созвона",
      followupHours: 24,
      followupType: "call_nurture",
      followupNote: "Вернуться после письменного объяснения"
    },
    awaiting_response: {
      nextAction: "Предложить новые варианты времени для созвона",
      followupHours: 24,
      followupType: "call_reschedule",
      followupNote: "Вернуться с новыми слотами для созвона"
    }
  },
  explore: {
    replied: {
      nextAction: "Отправить короткий пример решения",
      followupHours: 24,
      followupType: "example_followup",
      followupNote: "Вернуться после отправки примера"
    },
    qualified: {
      nextAction: "Показать подходящий кейс и следующий шаг",
      followupHours: 24,
      followupType: "case_followup",
      followupNote: "Вернуться после кейса или примера"
    },
    awaiting_response: {
      nextAction: "Поставить мягкий повторный контакт",
      followupHours: 48,
      followupType: "soft_followup",
      followupNote: "Мягко вернуться к клиенту позже"
    }
  }
};

function addHoursIso(hours) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  return date.toISOString();
}

function getOutcomeAutomation(track, outcome) {
  if (!track || !outcome) {
    return null;
  }

  return TRACK_OUTCOME_AUTOMATION[track]?.[outcome] || null;
}

function formatRequestTrackLabel(track) {
  switch (track) {
    case "booking":
      return "Запись и доходимость";
    case "estimate":
      return "Расчёт и предложение";
    case "consultation":
      return "Созвон и разбор";
    case "explore":
      return "Изучает возможности";
    default:
      return track || "Не определён";
  }
}

function buildLeadRecommendation(lead) {
  const requestTrack = lead?.intakeSession?.requestTrack || null;
  const openTask = (lead?.tasks || []).find((item) => item.status === "OPEN");
  const pendingFollowup = (lead?.followups || []).find((item) => item.status === "PENDING");
  const activeAppointment = (lead?.appointments || []).find(
    (item) => item.status === "SCHEDULED" || item.status === "CONFIRMED"
  );

  if (activeAppointment) {
    return {
      urgency: activeAppointment.status === "CONFIRMED" ? "stable" : "urgent",
      title:
        activeAppointment.status === "CONFIRMED"
          ? "Держим запись под контролем"
          : "Нужно дожать запись до подтверждения",
      reason:
        activeAppointment.status === "CONFIRMED"
          ? `У лида уже есть подтверждённая запись на ${activeAppointment.scheduledAt}.`
          : `По лиду уже стоит запись на ${activeAppointment.scheduledAt}, но её ещё важно закрепить.`,
      checklist: [
        activeAppointment.status === "CONFIRMED"
          ? "Проверь, ушло ли напоминание и нет ли риска неявки."
          : "Подтверди слот и убедиcь, что клиент понял время и формат.",
        activeAppointment.location
          ? `Уточни формат визита: ${activeAppointment.location}.`
          : "Уточни формат визита или созвона.",
        "Если клиент сомневается, сразу предложи запасной слот, а не откладывай контакт."
      ]
    };
  }

  if (openTask) {
    return {
      urgency: "urgent",
      title: openTask.title || "Есть активная задача по лиду",
      reason: openTask.dueAt
        ? `Сейчас по лиду открыта задача с ориентиром на ${openTask.dueAt}.`
        : "Сейчас по лиду есть открытая задача, она должна быть следующим действием команды.",
      checklist: [
        openTask.description || "Сверь формулировку задачи с тем, что реально нужно клиенту.",
        "Закрой задачу только после реального действия, а не после просмотра карточки.",
        "Если шаг поменялся, сразу зафиксируй новый исход и следующий контакт."
      ]
    };
  }

  if (pendingFollowup) {
    return {
      urgency: "watch",
      title: formatFollowupTypeLabel(pendingFollowup.type),
      reason: pendingFollowup.scheduledAt
        ? `По лиду уже назначен следующий контакт на ${pendingFollowup.scheduledAt}.`
        : "По лиду уже назначен следующий контакт, лучше не придумывать новый шаг с нуля.",
      checklist: [
        pendingFollowup.note || "Открой повторный контакт и проверь, зачем он был поставлен.",
        "Перед касанием перечитай последние сообщения, чтобы не писать мимо контекста.",
        "После контакта сразу зафиксируй новый исход, чтобы цепочка не обрывалась."
      ]
    };
  }

  if (lead?.intakeSession?.status === "ACTIVE") {
    return {
      urgency: "watch",
      title: "Нужно довести мини-ТЗ до конца",
      reason: "Бот уже начал собирать вводные, но квалификация ещё не завершена.",
      checklist: [
        "Не сбивай клиента длинным ручным ответом, пока бот не доберёт контекст.",
        "Смотри на текущий шаг квалификации и помогай только если человек застрял.",
        "Как только мини-ТЗ соберётся, зафиксируй следующий шаг уже по сути запроса."
      ]
    };
  }

  switch (requestTrack) {
    case "booking":
      return {
        urgency: "watch",
        title: "Довести лида до конкретной записи",
        reason: "Запрос выглядит как сценарий записи и доходимости, тут ценность в быстром закреплении слота.",
        checklist: [
          "Предложи конкретное время, а не абстрактное «когда вам удобно».",
          "Сразу снимай риск неявки: подтверждение, напоминание, запасной слот.",
          "Если клиент не готов, ставь мягкий повторный контакт, а не теряй диалог."
        ]
      };
    case "estimate":
      return {
        urgency: "watch",
        title: "Собрать рамку расчёта и вернутьcя с предложением",
        reason: "У лида запрос на расчёт или предложение, значит менеджеру важно быстро сузить объём и бюджет.",
        checklist: [
          "Уточни, что клиент хочет получить на первом этапе.",
          "Не отправляй общее предложение без рамки работ и ожиданий.",
          "После отправки сразу назначь повторный контакт, а не жди пассивно."
        ]
      };
    case "consultation":
      return {
        urgency: "watch",
        title: "Перевести лид в короткий предметный созвон",
        reason: "По этому лиду логичнее всего двигаться через короткий разбор, а не длинную переписку.",
        checklist: [
          "Закрепи цель созвона в одном предложении.",
          "Предложи 2-3 слота, чтобы не растягивать договорённость.",
          "До созвона отправь рамку разговора, чтобы клиент пришёл в контексте."
        ]
      };
    case "explore":
      return {
        urgency: "stable",
        title: "Дать понятный пример и мягко довести до следующего шага",
        reason: "Лид пока изучает возможности, поэтому агрессивный дожим здесь хуже, чем ясный пример пользы.",
        checklist: [
          "Покажи один релевантный сценарий вместо длинного списка возможностей.",
          "Свяжи пример с болью клиента, а не с абстрактной автоматизацией.",
          "После этого предложи простой следующий шаг: созвон, расчёт или запись."
        ]
      };
    default:
      return {
        urgency: "stable",
        title: "Уточнить ближайший рабочий шаг по лиду",
        reason: "По этому лиду ещё не хватает явного сценария, поэтому лучше быстро сузить контекст и выбрать одно действие.",
        checklist: [
          "Посмотри последние сообщения и пойми, что клиент хочет прямо сейчас.",
          "Не делай два шага сразу: выбери один следующий контакт.",
          "После ответа сразу зафиксируй исход, чтобы система не теряла контекст."
        ]
      };
  }
}

export async function getDashboardData() {
  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const companyId = getCompanyId();

      const [
        leadStatsResult,
        overdueResult,
        queueResult,
        sourceResult,
        stageResult,
        appointmentSummaryResult
      ] =
        await Promise.all([
          query(
            `
              select
                count(*) filter (where created_at::date = current_date) as new_today,
                count(*) filter (where status = 'WON') as won_total,
                count(*) filter (where status = 'NEW') as waiting_first_response
              from leads
              where company_id = $1
            `,
            [companyId]
          ),
          query(
            `
              select count(*) as overdue_tasks
              from overdue_tasks_queue
              where company_id = $1
            `,
            [companyId]
          ),
          query(
            `
              select
                l.id,
                coalesce(l.full_name, l.telegram_username, 'Р‘РµР· РёРјРµРЅРё') as lead_name,
                l.source,
                l.status,
                l.first_response_due_at,
                coalesce(u.full_name, 'РќРµ РЅР°Р·РЅР°С‡РµРЅ') as owner_name
              from leads l
              left join users u on u.id = l.assigned_user_id
              where l.company_id = $1
                and l.status not in ('WON', 'LOST')
              order by l.created_at desc
              limit 5
            `,
            [companyId]
          ),
          query(
            `
              select
                coalesce(source, 'unknown') as source,
                count(*) as leads,
                avg(lead_cost) as avg_cpl
              from leads
              where company_id = $1
              group by source
              order by count(*) desc
              limit 4
            `,
            [companyId]
          ),
          query(
            `
              select status, count(*) as total
              from leads
              where company_id = $1
              group by status
            `,
            [companyId]
          ),
          query(
            `
              select
                count(*) filter (
                  where scheduled_at::date = current_date
                    and status in ('SCHEDULED', 'CONFIRMED', 'COMPLETED')
                ) as today_bookings,
                count(*) filter (where status = 'CONFIRMED') as confirmed_bookings,
                count(*) filter (where status = 'NO_SHOW') as no_show_bookings,
                coalesce(sum(revenue_amount) filter (where status = 'COMPLETED'), 0) as completed_revenue
              from appointments
              where company_id = $1
            `,
            [companyId]
          )
        ]);

      const statRow = leadStatsResult.rows[0] || {};
      const overdueRow = overdueResult.rows[0] || {};
      const appointmentRow = appointmentSummaryResult.rows[0] || {};
      const stageMap = Object.fromEntries(
        stageResult.rows.map((row) => [row.status, Number(row.total || 0)])
      );
      return {
        stats: [
          {
            label: "Новые заявки",
            value: String(statRow.new_today || 0),
            note: "Сколько новых клиентов вошло в работу за сегодня"
          },
          {
            label: "Замеры на сегодня",
            value: String(appointmentRow.today_bookings || 0),
            note: "Замеры, консультации и выезды, назначенные на сегодня"
          },
          {
            label: "Подтверждённые выезды",
            value: String(appointmentRow.confirmed_bookings || 0),
            note: "Клиенты подтвердили адрес, время и готовность к выезду"
          },
          {
            label: "Просроченный возврат",
            value: String(overdueRow.overdue_tasks || 0),
            note:
              Number(appointmentRow.no_show_bookings || 0) > 0
                ? `Сорванных замеров: ${appointmentRow.no_show_bookings}`
                : "Сделки, по которым нужен возврат менеджера"
          }
        ],
        stages: [
          {
            name: "Новая заявка",
            count: stageMap.NEW || 0,
            tone: "var(--tone-coral)"
          },
          {
            name: "Связаться",
            count: stageMap.CONTACTED || 0,
            tone: "var(--tone-gold)"
          },
          {
            name: "Расчёт стоимости",
            count: stageMap.QUALIFIED || 0,
            tone: "var(--tone-sky)"
          },
          {
            name: "Замер назначен",
            count: stageMap.MEETING || 0,
            tone: "var(--tone-teal)"
          },
          {
            name: "Согласование",
            count: stageMap.PROPOSAL || 0,
            tone: "var(--tone-ink)"
          }
        ],
        queue: queueResult.rows.map((row) => ({
          slug: row.id,
          lead: row.lead_name,
          source: row.source,
          owner: row.owner_name,
          deadline: row.first_response_due_at
            ? new Date(row.first_response_due_at).toLocaleString("ru-RU")
            : "РќРµ Р·Р°РґР°РЅ",
          status: normalizeLeadStatus(row.status)
        })),
        sources: sourceResult.rows.map((row) => ({
          name: row.source,
          leads: Number(row.leads || 0),
          cpl: row.avg_cpl ? formatMoneyText(row.avg_cpl) : "n/a",
          result: "Живой канал"
        })),
        modules: clone(systemModules),
        appointmentPulse: {
          today: Number(appointmentRow.today_bookings || 0),
          confirmed: Number(appointmentRow.confirmed_bookings || 0),
          noShow: Number(appointmentRow.no_show_bookings || 0),
          revenue: formatMoneyText(appointmentRow.completed_revenue)
        }
      };
    } catch (error) {
      console.warn("Dashboard live data fallback:", error.message);
    }
  }

  try {
    const mockLeads = getMockLeadDataset().map((lead) => buildFurnitureLead(lead));
    const mockAppointments = buildMockAppointmentEntries();
    const today = new Date();
    const stageCount = {
      NEW: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      MEETING: 0,
      PROPOSAL: 0
    };

    for (const lead of mockLeads) {
      const normalizedStatus = normalizeLeadStatus(lead.status);

      if (stageCount[normalizedStatus] != null) {
        stageCount[normalizedStatus] += 1;
      }
    }

    const queue = mockLeads
      .filter((lead) => !["WON", "LOST"].includes(normalizeLeadStatus(lead.status)))
      .sort((left, right) => {
        const leftDate = parseBusinessDate(left.nextContactAt || left.deadline || left.createdAt);
        const rightDate = parseBusinessDate(
          right.nextContactAt || right.deadline || right.createdAt
        );

        if (!leftDate && !rightDate) {
          return 0;
        }

        if (!leftDate) {
          return 1;
        }

        if (!rightDate) {
          return -1;
        }

        return leftDate.getTime() - rightDate.getTime();
      })
      .slice(0, 5)
      .map((lead) => ({
        slug: lead.slug,
        lead: lead.name,
        source: lead.source,
        owner: lead.manager || "Не назначен",
        deadline: lead.nextContactAt || lead.deadline || "Не задан",
        status: normalizeLeadStatus(lead.status)
      }));

    const sourceMap = new Map();

    for (const lead of mockLeads) {
      const sourceName = lead.source || "Не указан";
      const current = sourceMap.get(sourceName) || {
        name: sourceName,
        leads: 0,
        cpl: "n/a",
        result: "В работе"
      };
      current.leads += 1;
      sourceMap.set(sourceName, current);
    }

    const todayAppointments = mockAppointments.filter((item) => {
      const date = parseBusinessDate(item.scheduledAt, item.scheduledAtIso);
      return date && isSameDay(date, today);
    });
    const confirmedAppointments = mockAppointments.filter((item) => item.status === "CONFIRMED");
    const noShowAppointments = mockAppointments.filter((item) => item.status === "NO_SHOW");
    const newTodayCount = mockLeads.filter((lead) => {
      const date = parseBusinessDate(lead.createdAt);
      return date && isSameDay(date, today);
    }).length;

    return {
      stats: [
        {
          label: "Новые заявки",
          value: String(newTodayCount || mockLeads.filter((lead) => lead.status === "NEW").length),
          note: "Сколько новых клиентов появилось в CRM сегодня"
        },
        {
          label: "На расчёт",
          value: String(
            mockLeads.filter((lead) => lead.calculationStatus !== "Не начинали").length
          ),
          note: "Сделки, где уже нужен расчёт, смета или уточнение материалов"
        },
        {
          label: "Замеры на неделе",
          value: String(
            mockAppointments.filter((item) =>
              ["SCHEDULED", "CONFIRMED", "COMPLETED"].includes(item.status)
            ).length
          ),
          note: "Выезды, шоурумы и консультации, которые команда ведёт в работу"
        },
        {
          label: "Просроченный возврат",
          value: String(
            buildMockFollowupEntries().filter((item) => item.status === "PENDING").length
          ),
          note: noShowAppointments.length
            ? `Сорванных замеров: ${noShowAppointments.length}`
            : "Сделки, по которым менеджеру нужно вернуться к клиенту"
        }
      ],
      stages: [
        { name: "Новая заявка", count: stageCount.NEW, tone: "var(--accent)" },
        { name: "Связаться", count: stageCount.CONTACTED, tone: "var(--sand)" },
        { name: "Расчёт стоимости", count: stageCount.QUALIFIED, tone: "var(--info)" },
        { name: "Замер назначен", count: stageCount.MEETING, tone: "var(--olive)" },
        { name: "Согласование", count: stageCount.PROPOSAL, tone: "var(--wine)" }
      ],
      queue,
      sources: Array.from(sourceMap.values()).slice(0, 4),
      modules: clone(systemModules),
      appointmentPulse: {
        today: todayAppointments.length,
        confirmed: confirmedAppointments.length,
        noShow: noShowAppointments.length,
        revenue: formatMoneyText(
          mockAppointments.reduce(
            (sum, item) => sum + getNumericAmount(item.revenueAmount),
            0
          ),
          "0 ₸"
        )
      }
    };
  } catch (error) {
    console.warn("Dashboard mock data fallback:", error.message);
    return buildStaticDashboardData();
  }
}

export async function getLeadsData() {
  const companyId = getCompanyId();
  const cacheKey = `leads:${companyId || "mock"}`;
  const cached = readRuntimeCache(cacheKey, 8000);

  if (cached) {
    return cached;
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const result = await query(
        `
          select
            l.id,
            coalesce(l.full_name, l.telegram_username, 'Клиент без имени') as name,
            l.phone,
            l.channel,
            l.source,
            coalesce(u.full_name, 'Не назначен') as manager,
            l.status,
            l.temperature,
            l.notes,
            coalesce(t.title, f.notes, null) as next_action,
            f.followup_type,
            coalesce(t.due_at, f.scheduled_at) as due_at,
            a.appointment_type,
            a.appointment_status,
            a.appointment_scheduled_at,
            a.appointment_location,
            l.updated_at,
            l.created_at
          from leads l
          left join users u on u.id = l.assigned_user_id
          left join lateral (
            select title, due_at
            from tasks
            where lead_id = l.id
              and company_id = l.company_id
              and status = 'OPEN'
            order by due_at asc nulls last, created_at desc
            limit 1
          ) t on true
          left join lateral (
            select followup_type, scheduled_at, notes
            from lead_followups
            where lead_id = l.id
              and company_id = l.company_id
              and status = 'PENDING'
            order by scheduled_at asc nulls last, created_at desc
            limit 1
          ) f on true
          left join lateral (
            select
              appointment_type,
              status as appointment_status,
              scheduled_at as appointment_scheduled_at,
              location as appointment_location
            from appointments
            where lead_id = l.id
              and company_id = l.company_id
            order by
              case
                when status in ('SCHEDULED', 'CONFIRMED') then 0
                when status = 'COMPLETED' then 1
                else 2
              end,
              scheduled_at desc
            limit 1
          ) a on true
          where l.company_id = $1
          order by l.created_at desc
          limit 50
        `,
        [getCompanyId()]
      );

      const leadIds = result.rows.map((row) => row.id);
      const contextResult = leadIds.length
        ? await query(
            `
              select distinct on (e.lead_id)
                e.lead_id,
                e.payload
              from lead_events e
              where e.company_id = $1
                and e.event_type = 'lead_order_context_updated'
                and e.lead_id = any($2::uuid[])
              order by e.lead_id, e.created_at desc
            `,
            [getCompanyId(), leadIds]
          )
        : { rows: [] };
      const contextPatchMap = new Map(
        contextResult.rows.map((row) => [row.lead_id, row.payload?.context_patch || null])
      );

      const leads = result.rows.map((row) => {
        const nextContactText = row.due_at
          ? new Date(row.due_at).toLocaleString("ru-RU")
          : row.appointment_scheduled_at
            ? new Date(row.appointment_scheduled_at).toLocaleString("ru-RU")
            : "Не назначен";
        const lastTouch = row.updated_at
          ? new Date(row.updated_at).toLocaleString('ru-RU')
          : row.due_at
            ? new Date(row.due_at).toLocaleString('ru-RU')
            : 'Нет данных';
        let liveLead = {
          id: row.id.slice(0, 8).toUpperCase(),
          slug: row.id,
          name: row.name,
          phone: row.phone || "",
          channel: row.channel || 'Не указан',
          source: row.source || 'Не указан',
          manager: row.manager,
          status: normalizeLeadStatus(row.status),
          nextAction:
            row.next_action ||
            formatFollowupTypeLabel(row.followup_type) ||
            "Следующий шаг уточняется",
          deadline: row.due_at
            ? new Date(row.due_at).toLocaleString('ru-RU')
            : row.appointment_scheduled_at
              ? new Date(row.appointment_scheduled_at).toLocaleString("ru-RU")
              : 'Не назначен',
          nextContactAt: nextContactText,
          summary:
            row.notes?.trim() ||
            `Клиент ${row.name} оставил заявку из канала ${row.source || row.channel || "без источника"}.`,
          temperature: row.temperature || "тёплый",
          urgency: formatUrgencyLabel(row.temperature),
          budget: 'Уточняется',
          createdAt: row.created_at
            ? new Date(row.created_at).toLocaleString("ru-RU")
            : "Дата не указана",
          address: row.appointment_location || "Адрес уточняется после первого контакта",
          product: "Тип изделия уточняется",
          requestType: "Запрос уточняется",
          calculationStatus:
            row.status === "QUALIFIED" ? "В расчёте" : "Не начинали",
          prepaymentStatus: "Не запрошена",
          lastTouch,
          messages: [],
          appointments: row.appointment_scheduled_at
            ? [
                normalizeMeasurementRecord({
                  type: row.appointment_type,
                  status: row.appointment_status,
                  owner: row.manager,
                  scheduledAt: new Date(row.appointment_scheduled_at).toLocaleString("ru-RU"),
                  location: row.appointment_location || "Адрес уточняется"
                })
              ]
            : []
        };
        const contextPatch = contextPatchMap.get(row.id);

        if (isPlainObject(contextPatch)) {
          liveLead = mergeRecord(liveLead, contextPatch);
        }

        return buildFurnitureLead(liveLead);
      });

      writeRuntimeCache(cacheKey, leads);
      return leads;
    } catch (error) {
      console.warn('Leads live data fallback:', error.message);
    }
  }

  const fallback = getMockLeadDataset().map((lead) => buildFurnitureLead(lead));
  writeRuntimeCache(cacheKey, fallback);
  return fallback;
}

export async function getLeadBySlug(slug) {
  const companyId = getCompanyId();
  const cacheKey = `lead-detail:${companyId || "mock"}:${slug}`;
  const cached = readRuntimeCache(cacheKey, 5000);

  if (cached) {
    return cached;
  }

  const leads = await getLeadsData();
  const lead = leads.find((item) => item.slug === slug || item.id === slug);

  if (!lead) {
    return null;
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const [messagesResult, tasksResult, followupsResult, appointmentsResult, statusHistoryResult, activityResult, intakeResult] = await Promise.all([
        query(
                                        `
            select
              m.direction,
              m.sender_type,
              m.message_text,
              m.created_at
            from lead_messages m
            join leads l on l.id = m.lead_id
            where l.company_id = $1
              and l.id = $2
            order by m.created_at asc
            limit 100
          `,
          [getCompanyId(), slug]
        ),
        query(
          `
            select
              t.title,
              t.description,
              t.priority,
              t.status,
              t.due_at,
              coalesce(u.full_name, 'Не назначен') as owner_name
            from tasks t
            left join users u on u.id = t.assigned_user_id
            where t.company_id = $1
              and t.lead_id = $2
            order by
              case when t.status = 'OPEN' then 0 else 1 end,
              t.due_at asc nulls last,
              t.created_at desc
            limit 20
          `,
          [getCompanyId(), slug]
        ),
        query(
          `
            select
              f.followup_type,
              f.status,
              f.scheduled_at,
              f.notes,
              coalesce(u.full_name, 'Не назначен') as owner_name
            from lead_followups f
            left join users u on u.id = f.assigned_user_id
            where f.company_id = $1
              and f.lead_id = $2
            order by f.scheduled_at desc
            limit 20
          `,
          [getCompanyId(), slug]
        ),
        query(
          `
            select
              a.id,
              a.appointment_type,
              a.status,
              a.scheduled_at,
              a.duration_minutes,
              a.location,
              a.notes,
              a.outcome_note,
              a.revenue_amount,
              coalesce(u.full_name, 'Не назначен') as owner_name
            from appointments a
            left join users u on u.id = a.assigned_user_id
            where a.company_id = $1
              and a.lead_id = $2
            order by a.scheduled_at desc
            limit 20
          `,
          [getCompanyId(), slug]
        ),
        query(
          `
            select
              previous_status,
              next_status,
              change_reason,
              h.created_at,
              coalesce(u.full_name, 'System') as actor_name
            from lead_status_history h
            left join users u on u.id = h.changed_by_user_id
            where h.company_id = $1
              and h.lead_id = $2
            order by h.created_at desc
            limit 20
          `,
          [getCompanyId(), slug]
        ),
        query(
          `
            select
              e.event_type,
              e.payload,
              e.created_at,
              coalesce(u.full_name, 'System') as actor_name
            from lead_events e
            left join users u on u.id = e.actor_user_id
            where e.company_id = $1
              and e.lead_id = $2
            order by e.created_at desc
            limit 20
          `,
          [getCompanyId(), slug]
        ),
        query(
          `
            select
              status,
              current_step,
              answers,
              summary_text,
              created_at,
              updated_at,
              completed_at
            from lead_intake_sessions
            where company_id = $1
              and lead_id = $2
            order by created_at desc
            limit 1
          `,
          [getCompanyId(), slug]
        )
      ]);

      const intakeRow = intakeResult.rows[0] || null;
      const intakeAnswers = intakeRow?.answers && typeof intakeRow.answers === "object"
        ? intakeRow.answers
        : {};

      const detailedLead = {
        ...lead,
        messages: messagesResult.rows.map((row) => ({
          direction: row.direction,
          sender: row.sender_type,
          text: row.message_text || 'Текст сообщения не сохранён',
          time: new Date(row.created_at).toLocaleString('ru-RU')
        })),
        tasks: tasksResult.rows.map((row) => ({
          title: row.title,
          description: row.description || 'Описание задачи не заполнено',
          owner: row.owner_name,
          priority: row.priority,
          status: row.status,
          dueAt: row.due_at ? new Date(row.due_at).toLocaleString('ru-RU') : 'Не назначен'
        })),
        followups: followupsResult.rows.map((row) => ({
          type: formatFollowupTypeLabel(row.followup_type),
          status: row.status,
          owner: row.owner_name,
          scheduledAt: row.scheduled_at
            ? new Date(row.scheduled_at).toLocaleString('ru-RU')
            : 'Не назначен',
          note: row.notes || 'Комментарий не добавлен'
        })),
        appointments: appointmentsResult.rows.map((row) => normalizeMeasurementRecord({
          id: row.id,
          type: row.appointment_type,
          status: row.status,
          owner: row.owner_name,
          scheduledAt: row.scheduled_at
            ? new Date(row.scheduled_at).toLocaleString('ru-RU')
            : 'Не назначен',
          duration: row.duration_minutes ? `${row.duration_minutes} минут` : 'Не указана',
          location: row.location || 'Адрес уточняется',
          note: row.notes || 'Комментарий по замеру не добавлен',
          outcomeNote: row.outcome_note || '',
          revenueAmount: row.revenue_amount ? Number(row.revenue_amount) : null,
          dimensionsSummary: row.status === "COMPLETED"
            ? "Размеры сняты, карточка готова к расчёту"
            : "Размеры будут после выезда"
        })),
        statusHistory: statusHistoryResult.rows.map((row) => ({
          actor: row.actor_name,
          previousStatus: row.previous_status || '—',
          nextStatus: row.next_status,
          reason: row.change_reason || 'Комментарий не добавлен',
          time: new Date(row.created_at).toLocaleString('ru-RU')
        })),
        activity: activityResult.rows.map((row) => ({
          actor: row.actor_name,
          action: formatLeadEventAction(row.event_type),
          detail: formatLeadEventDetail(row.event_type, row.payload || {}),
          time: new Date(row.created_at).toLocaleString('ru-RU')
        })),
        intakeSession: intakeRow
          ? {
              status: intakeRow.status,
              currentStep: intakeRow.current_step,
              summaryText: intakeRow.summary_text || "",
              createdAt: intakeRow.created_at
                ? new Date(intakeRow.created_at).toLocaleString("ru-RU")
                : "Не указано",
              updatedAt: intakeRow.updated_at
                ? new Date(intakeRow.updated_at).toLocaleString("ru-RU")
                : "Не указано",
              completedAt: intakeRow.completed_at
                ? new Date(intakeRow.completed_at).toLocaleString("ru-RU")
                : null,
              requestTrack: intakeAnswers.request_track || null,
              answers: [
                ["Бизнес", intakeAnswers.business_type],
                ["Главный запрос", intakeAnswers.request],
                ["Тип запроса", formatRequestTrackLabel(intakeAnswers.request_track)],
                ["Проблемная зона", intakeAnswers.pain_point],
                ["Текущий процесс", intakeAnswers.current_flow],
                ["Поток и команда", intakeAnswers.volume],
                ["Желаемый результат", intakeAnswers.desired_outcome]
              ]
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => ({ label, value }))
            }
          : null
      };

      const enrichedLead = applyLeadContextEvents(detailedLead, activityResult.rows);

      const result = {
        ...buildFurnitureLead(enrichedLead),
        recommendation: buildLeadRecommendation(enrichedLead)
      };

      writeRuntimeCache(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('Lead detail live data fallback:', error.message);
    }
  }

  const fallbackLead = buildFurnitureLead({
    ...lead,
    tasks: lead.tasks || [],
    followups: lead.followups || [],
    appointments: lead.appointments || [],
    statusHistory: lead.statusHistory || [],
    activity: lead.activity || [],
    intakeSession: lead.intakeSession || null
  });

  const fallbackResult = {
    ...fallbackLead,
    recommendation: buildLeadRecommendation(fallbackLead)
  };

  writeRuntimeCache(cacheKey, fallbackResult);
  return fallbackResult;
}

export async function updateLeadWorkflow(slug, payload) {
  const statusInput = typeof payload.status === "string" ? payload.status.trim() : "";
  const nextActionInput = typeof payload.nextAction === "string" ? payload.nextAction.trim() : "";
  const lossReason = payload.lossReason?.trim() || null;
  const followupAt = payload.followupAt?.trim() || null;
  const contextUpdate = buildLeadContextPatch(payload);
  const hasWorkflowUpdate = Boolean(statusInput || nextActionInput || lossReason || followupAt);

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const currentLeadResult = await query(
        `
          select status
          from leads
          where id = $1
            and company_id = $2
          limit 1
        `,
        [slug, getCompanyId()]
      );

      const previousStatus = currentLeadResult.rows[0]?.status || null;
      const nextStatus = statusInput ? normalizeLeadStatus(statusInput) : previousStatus || "NEW";
      const nextAction = nextActionInput || (hasWorkflowUpdate ? "Проверить следующий шаг" : null);

      const result = await query(
        `
          update leads
          set status = $2,
              updated_at = now(),
              notes = case
                when $3 is not null and $3 <> '' then $3
                else notes
              end
          where id = $1
            and company_id = $4
          returning id, status
        `,
        [slug, nextStatus, nextAction, getCompanyId()]
      );

      if (!result.rows[0]) {
        return { ok: false, message: "Сделка не найдена в live-базе" };
      }

      if (statusInput || nextAction || followupAt) {
        await query(
          `
            insert into lead_status_history (
              company_id,
              lead_id,
              previous_status,
              next_status,
              change_reason
            )
            values (
              $1,
              $2,
              null,
              $3,
              $4
            )
          `,
          [getCompanyId(), slug, nextStatus, lossReason || nextAction || "Изменения по сделке"]
        );
      }

      if (followupAt) {
        await query(
          `
            insert into lead_followups (
              company_id,
              lead_id,
              followup_type,
              scheduled_at,
              notes
            )
            values ($1, $2, 'custom', $3::timestamptz, $4)
          `,
          [getCompanyId(), slug, followupAt, nextAction]
        );

        await logLeadEvent(getCompanyId(), slug, "followup_created", {
          followup_at: followupAt,
          note: nextAction,
          followup_type: "custom"
        });
      }

      if (statusInput || nextAction) {
        await logLeadEvent(getCompanyId(), slug, "lead_workflow_updated", {
          previous_status: previousStatus,
          next_status: nextStatus,
          next_action: nextAction
        });
      }

      if (contextUpdate) {
        await logLeadEvent(getCompanyId(), slug, "lead_order_context_updated", {
          updated_sections: contextUpdate.sections,
          context_patch: contextUpdate.patch
        });
      }

      if (nextStatus === "LOST" && lossReason) {
        await query(
          `
            insert into lead_events (
              company_id,
              lead_id,
              event_type,
              payload
            )
            values (
              $1,
              $2,
              'lead_lost_reason_saved',
              jsonb_build_object('loss_reason', $3)
            )
          `,
          [getCompanyId(), slug, lossReason]
        );
      }

      invalidateRuntimeCache();

      return {
        ok: true,
        mode: "live",
        message: contextUpdate
          ? `Сохранены блоки: ${formatLeadContextSectionLabels(contextUpdate.sections)}`
          : "Изменения по сделке сохранены в базе"
      };
    } catch (error) {
      console.warn("Lead workflow update fallback:", error.message);
      return {
        ok: false,
        mode: "live",
        message: `Ошибка сохранения сделки в live-базу: ${error.message}`
      };
    }
  }

  const mockPatch = {
    lastTouch: new Date().toLocaleString("ru-RU")
  };

  if (statusInput) {
    mockPatch.status = normalizeLeadStatus(statusInput);
  }

  if (nextActionInput) {
    mockPatch.nextAction = nextActionInput;
  } else if (hasWorkflowUpdate) {
    mockPatch.nextAction = "Проверить следующий шаг";
  }

  if (followupAt) {
    mockPatch.nextContactAt = followupAt;
  }

  if (contextUpdate) {
    Object.assign(mockPatch, mergeRecord(mockPatch, contextUpdate.patch));
  }

  await writeMockLeadPatch(slug, mockPatch);
  invalidateRuntimeCache();

  return {
    ok: true,
    mode: "mock",
    message: contextUpdate
      ? `Сохранены блоки: ${formatLeadContextSectionLabels(contextUpdate.sections)}`
      : "Live-база не подключена. Изменения сохранены в локальный mock-store.",
    preview: {
      slug,
      status: statusInput ? normalizeLeadStatus(statusInput) : null,
      nextAction: mockPatch.nextAction || null,
      lossReason,
      followupAt,
      updatedSections: contextUpdate?.sections || []
    }
  };
}

export async function captureManagerOutcome(slug, payload) {
  const outcome = String(payload.outcome || "").trim() || "awaiting_response";
  const nextStatus = normalizeLeadStatus(
    payload.status || normalizeOutcomeStatus(outcome)
  );
  const note = payload.note?.trim() || "";
  const nextAction = payload.nextAction?.trim() || "";
  const followupAt = payload.followupAt?.trim() || null;

  if (!slug) {
    return {
      ok: false,
      message: "Нужен идентификатор лида"
    };
  }

  if (!note) {
    return {
      ok: false,
      message: "Нужно коротко описать результат контакта"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const pool = getPool();
      const client = await pool.connect();
      const run = (text, params = []) => client.query(text, params);

      try {
        await run("begin");

        const currentLeadResult = await run(
          `
            select
              l.status,
              l.assigned_user_id,
              lis.answers ->> 'request_track' as request_track
            from leads l
            left join lateral (
              select answers
              from lead_intake_sessions
              where lead_id = l.id
                and company_id = l.company_id
              order by created_at desc
              limit 1
            ) lis on true
            where id = $1
              and l.company_id = $2
            limit 1
          `,
          [slug, getCompanyId()]
        );

        const previousStatus = currentLeadResult.rows[0]?.status || null;
        const assignedUserId = currentLeadResult.rows[0]?.assigned_user_id || null;
        const requestTrack = currentLeadResult.rows[0]?.request_track || null;
        const automation = getOutcomeAutomation(requestTrack, outcome);
        const resolvedNextAction =
          nextAction || automation?.nextAction || note;
        const resolvedFollowupAt =
          followupAt || (automation?.followupHours ? addHoursIso(automation.followupHours) : null);

        const result = await run(
          `
            update leads
            set status = $2,
                updated_at = now(),
                notes = $3
            where id = $1
              and company_id = $4
            returning id
          `,
          [slug, nextStatus, note, getCompanyId()]
        );

        if (!result.rows[0]) {
          await run("rollback");

          return {
            ok: false,
            mode: "live",
            message: "Лид не найден в базе"
          };
        }

        if (previousStatus !== nextStatus) {
          await run(
            `
              insert into lead_status_history (
                company_id,
                lead_id,
                previous_status,
                next_status,
                change_reason
              )
              values ($1, $2, $3, $4, $5)
            `,
            [
              getCompanyId(),
              slug,
              previousStatus,
              nextStatus,
              `Outcome: ${outcome}. ${note}`
            ]
          );
        }

        const closedTasksResult = await run(
          `
            update tasks
            set status = 'DONE',
                completed_at = now()
            where company_id = $1
              and lead_id = $2
              and status = 'OPEN'
              and (
                title ilike 'Первый контакт%'
                or title ilike 'Ответить новому лиду%'
              )
            returning title
          `,
          [getCompanyId(), slug]
        );

        for (const taskRow of closedTasksResult.rows) {
          await logLeadEvent(
            getCompanyId(),
            slug,
            "task_completed",
            {
              title: taskRow.title,
              executor_note: "Автоматически закрыто после фиксации исхода контакта"
            },
            run
          );
        }

        await logLeadEvent(
          getCompanyId(),
          slug,
          "manager_outcome_logged",
          {
            outcome,
            note,
            next_status: nextStatus,
            next_action: resolvedNextAction,
            followup_at: resolvedFollowupAt,
            request_track: requestTrack
          },
          run
        );

        const cancelledFollowupsResult = await run(
          `
            update lead_followups
            set status = 'CANCELLED',
                completed_at = now()
            where company_id = $1
              and lead_id = $2
              and status = 'PENDING'
            returning followup_type, scheduled_at, notes
          `,
          [getCompanyId(), slug]
        );

        for (const followupRow of cancelledFollowupsResult.rows) {
          await logLeadEvent(
            getCompanyId(),
            slug,
            "followup_completed",
            {
              followup_type: followupRow.followup_type,
              scheduled_at: followupRow.scheduled_at,
              executor_note: "Автоматически снято после нового исхода контакта"
            },
            run
          );
        }

        if (resolvedFollowupAt) {
          await run(
            `
              insert into lead_followups (
                company_id,
                lead_id,
                assigned_user_id,
                followup_type,
                scheduled_at,
                notes
              )
              values ($1, $2, $3, $4, $5::timestamptz, $6)
            `,
            [
              getCompanyId(),
              slug,
              assignedUserId,
              automation?.followupType || "custom",
              resolvedFollowupAt,
              automation?.followupNote || resolvedNextAction || note
            ]
          );

          await logLeadEvent(
            getCompanyId(),
            slug,
            "followup_created",
            {
              followup_type: automation?.followupType || "custom",
              scheduled_at: resolvedFollowupAt,
              note: automation?.followupNote || resolvedNextAction || note,
              auto_created: Boolean(automation)
            },
            run
          );
        }

        if (automation?.taskTitle) {
          await run(
            `
              insert into tasks (
                company_id,
                lead_id,
                assigned_user_id,
                title,
                description,
                priority,
                due_at
              )
              values ($1, $2, $3, $4, $5, 'high', $6::timestamptz)
            `,
            [
              getCompanyId(),
              slug,
              assignedUserId,
              automation.taskTitle,
              automation.taskDescription,
              resolvedFollowupAt || addHoursIso(12)
            ]
          );

          await logLeadEvent(
            getCompanyId(),
            slug,
            "task_created",
            {
              title: automation.taskTitle,
              description: automation.taskDescription,
              deadline: resolvedFollowupAt || addHoursIso(12),
              auto_created: true,
              request_track: requestTrack
            },
            run
          );
        }

        if (nextStatus === "LOST") {
          await logLeadEvent(
            getCompanyId(),
            slug,
            "lead_lost_reason_saved",
            {
              loss_reason: note
            },
            run
          );
        }

        invalidateRuntimeCache();

        await run("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return {
        ok: true,
        mode: "live",
        message: "Результат контакта сохранён"
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Ошибка сохранения результата: ${error.message}`
      };
    }
  }

  await writeMockLeadPatch(slug, {
    status: nextStatus,
    managerComment: note,
    nextAction: nextAction || note,
    nextContactAt: followupAt || undefined,
    lastTouch: new Date().toLocaleString("ru-RU")
  });
  invalidateRuntimeCache();

  return {
    ok: true,
    mode: "mock",
    message: "Результат контакта сохранён в локальный mock-store",
    preview: {
      slug,
      outcome,
      nextStatus,
      note,
      nextAction,
      followupAt
    }
  };
}

export async function getTasksData() {
  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const result = await query(
        `
          select
            t.title,
            t.priority,
            t.due_at,
            coalesce(u.full_name, 'Не назначен') as owner_name,
            coalesce(l.status, 'NO_LEAD') as lead_status,
            l.id as lead_id,
            coalesce(l.full_name, l.telegram_username, 'Без имени') as lead_name
          from tasks t
          left join users u on u.id = t.assigned_user_id
          left join leads l on l.id = t.lead_id
          where t.company_id = $1
            and t.status = 'OPEN'
          order by t.due_at asc nulls last, t.created_at desc
          limit 30
        `,
        [getCompanyId()]
      );

      const urgent = [];
      const inProgress = [];
      const closing = [];

      for (const row of result.rows) {
        const item = {
          title: row.title,
          lead: row.lead_name,
          slug: row.lead_id || null,
          owner: row.owner_name,
          deadline: row.due_at
            ? new Date(row.due_at).toLocaleString("ru-RU")
            : "Не назначен",
          tag: getLeadStatusLabel(row.lead_status)
        };

        if (row.priority === "high") {
          urgent.push(item);
        } else if (row.lead_status === "PROPOSAL") {
          closing.push(item);
        } else {
          inProgress.push(item);
        }
      }

      return [
        normalizeTaskColumn("Срочно", urgent, "var(--tone-coral)"),
        normalizeTaskColumn("В работе", inProgress, "var(--tone-gold)"),
        normalizeTaskColumn("На дожим", closing, "var(--tone-sky)")
      ];
    } catch (error) {
      console.warn("Tasks live data fallback:", error.message);
    }
  }

  return clone(taskColumns);
}

export async function getFollowupsData() {
  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const result = await query(
        `
          select
            l.id as lead_id,
            coalesce(l.full_name, l.telegram_username, 'Р‘РµР· РёРјРµРЅРё') as lead_name,
            coalesce(u.full_name, 'РќРµ РЅР°Р·РЅР°С‡РµРЅ') as owner_name,
            f.followup_type,
            f.scheduled_at,
            f.notes,
            f.status
          from lead_followups f
          left join leads l on l.id = f.lead_id
          left join users u on u.id = f.assigned_user_id
          where f.company_id = $1
          order by f.scheduled_at asc
          limit 50
        `,
        [getCompanyId()]
      );

      return result.rows.map((row) => ({
        slug: row.lead_id || null,
        lead: row.lead_name,
        owner: row.owner_name,
        type: formatFollowupTypeLabel(row.followup_type),
        typeKey: row.followup_type,
        scheduledAt: row.scheduled_at
          ? new Date(row.scheduled_at).toLocaleString("ru-RU")
          : "Не назначено",
        scheduledAtIso: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
        note: row.notes || "Комментарий не добавлен",
        status: row.status
      }));
    } catch (error) {
      console.warn("Followups live data fallback:", error.message);
    }
  }

  const mockFollowups = buildMockFollowupEntries();
  return mockFollowups.length ? mockFollowups : clone(followupQueue);
}

export function getAppointmentStatusOptions() {
  return ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
}

export async function getAppointmentsData() {
  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const result = await query(
        `
          select
            a.id,
            a.lead_id,
            coalesce(l.full_name, l.telegram_username, 'Клиент без имени') as lead_name,
            coalesce(u.full_name, 'Не назначен') as owner_name,
            a.appointment_type,
            a.status,
            a.scheduled_at,
            a.duration_minutes,
            a.location,
            a.notes,
            a.outcome_note,
            a.revenue_amount
          from appointments a
          left join leads l on l.id = a.lead_id
          left join users u on u.id = a.assigned_user_id
          where a.company_id = $1
          order by a.scheduled_at asc
          limit 100
        `,
        [getCompanyId()]
      );

      return result.rows.map((row) => normalizeMeasurementRecord({
        id: row.id,
        slug: row.lead_id || null,
        lead: row.lead_name,
        owner: row.owner_name,
        type: row.appointment_type,
        status: row.status,
        scheduledAtIso: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
        scheduledAt: row.scheduled_at
          ? new Date(row.scheduled_at).toLocaleString("ru-RU")
          : "Не назначено",
        duration: row.duration_minutes ? `${row.duration_minutes} минут` : "Не указана",
        location: row.location || "Адрес уточняется",
        note: row.notes || "Комментарий по замеру не добавлен",
        outcomeNote: row.outcome_note || "",
        revenueAmount: row.revenue_amount ? Number(row.revenue_amount) : null,
        dimensionsSummary:
          row.status === "COMPLETED"
            ? "Размеры сняты, карточка готова к расчёту"
            : "Размеры будут добавлены после выезда"
      }));
    } catch (error) {
      console.warn("Appointments live data fallback:", error.message);
    }
  }

  const mockAppointments = buildMockAppointmentEntries();
  return mockAppointments.length
    ? mockAppointments
    : clone(appointmentsSnapshot).map((item) => normalizeMeasurementRecord(item));
}

function inferDialogueAction({ leadStatus, latestDirection, appointmentStatus, followupAt }) {
  if (appointmentStatus === "NO_SHOW") {
    return {
      key: "recovery",
      label: "Вернуть после no-show",
      note: "Клиент сорвал слот, лучше быстро вернуть его в новый диалог."
    };
  }

  if (appointmentStatus === "SCHEDULED") {
    return {
      key: "booking",
      label: "Подтвердить запись",
      note: "Есть слот без финального подтверждения."
    };
  }

  if (leadStatus === "NEW" || latestDirection === "inbound") {
    return {
      key: "reply",
      label: "Ответить сейчас",
      note: "Последнее касание за клиентом, команде лучше не тянуть."
    };
  }

  if (followupAt) {
    return {
      key: "followup",
      label: "Сделать follow-up",
      note: "По лиду уже есть назначенное следующее касание."
    };
  }

  return {
    key: "ongoing",
    label: "Продолжить диалог",
    note: "Диалог живой, нужен следующий осмысленный шаг."
  };
}

export async function getDialogueInboxData() {
  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const result = await query(
        `
          select
            l.id,
            coalesce(l.full_name, l.telegram_username, 'No name') as lead_name,
            l.channel,
            l.source,
            l.status,
            l.updated_at,
            coalesce(u.full_name, 'Unassigned') as owner_name,
            latest_message.direction as latest_direction,
            latest_message.message_text as latest_message_text,
            latest_message.created_at as latest_message_at,
            next_followup.scheduled_at as next_followup_at,
            next_followup.notes as next_followup_note,
            latest_appointment.status as latest_appointment_status,
            latest_appointment.scheduled_at as latest_appointment_at
          from leads l
          left join users u on u.id = l.assigned_user_id
          left join lateral (
            select m.direction, m.message_text, m.created_at
            from lead_messages m
            where m.lead_id = l.id
            order by m.created_at desc
            limit 1
          ) latest_message on true
          left join lateral (
            select f.scheduled_at, f.notes
            from lead_followups f
            where f.lead_id = l.id
              and f.status = 'PENDING'
            order by f.scheduled_at asc
            limit 1
          ) next_followup on true
          left join lateral (
            select a.status, a.scheduled_at
            from appointments a
            where a.lead_id = l.id
            order by a.scheduled_at desc
            limit 1
          ) latest_appointment on true
          where l.company_id = $1
          order by coalesce(latest_message.created_at, l.updated_at, l.created_at) desc
          limit 100
        `,
        [getCompanyId()]
      );

      return result.rows.map((row) => {
        const suggested = inferDialogueAction({
          leadStatus: row.status,
          latestDirection: row.latest_direction,
          appointmentStatus: row.latest_appointment_status,
          followupAt: row.next_followup_at
        });

        return {
          slug: row.id,
          lead: row.lead_name,
          owner: row.owner_name,
          channel: row.channel || "unknown",
          source: row.source || "unknown",
          status: normalizeLeadStatus(row.status),
          lastMessageAt: row.latest_message_at
            ? new Date(row.latest_message_at).toLocaleString("ru-RU")
            : "Нет сообщений",
          lastMessageText: row.latest_message_text || "История диалога ещё пустая.",
          lastDirection: row.latest_direction || "none",
          nextFollowupAt: row.next_followup_at
            ? new Date(row.next_followup_at).toLocaleString("ru-RU")
            : null,
          nextFollowupNote: row.next_followup_note || null,
          appointmentStatus: row.latest_appointment_status || null,
          appointmentAt: row.latest_appointment_at
            ? new Date(row.latest_appointment_at).toLocaleString("ru-RU")
            : null,
          suggestedAction: suggested
        };
      });
    } catch (error) {
      console.warn("Dialogue inbox live data fallback:", error.message);
    }
  }

  return [
    {
      slug: "l-001",
      lead: "Азамат Н.",
      owner: "Manager 1",
      channel: "Telegram",
      source: "Meta Ads",
      status: "NEW",
      lastMessageAt: "Сегодня, 13:20",
      lastMessageText: "Хочу узнать подробнее про автоматизацию заявок.",
      lastDirection: "inbound",
      nextFollowupAt: null,
      nextFollowupNote: null,
      appointmentStatus: null,
      appointmentAt: null,
      suggestedAction: {
        key: "reply",
        label: "Ответить сейчас",
        note: "Последнее касание за клиентом, команде лучше не тянуть."
      }
    }
  ];
}

export async function createAppointment(payload) {
  const lead = payload.lead?.trim() || null;
  const owner = payload.owner?.trim() || null;
  const type = payload.type?.trim() || "consultation";
  const scheduledAt = payload.scheduledAt?.trim() || null;
  const durationMinutes = payload.durationMinutes
    ? Number(payload.durationMinutes)
    : null;
  const location = payload.location?.trim() || null;
  const note = payload.note?.trim() || null;

  if (!lead || !scheduledAt) {
    return {
      ok: false,
      message: "Нужно указать клиента и дату замера или встречи"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      let assignedUserId = null;

      if (owner) {
        const userResult = await query(
          `
            select id
            from users
            where company_id = $1
              and full_name = $2
            limit 1
          `,
          [getCompanyId(), owner]
        );

        assignedUserId = userResult.rows[0]?.id || null;
      }

      const leadResult = await query(
        `
          select id, status
          from leads
          where company_id = $1
            and (full_name = $2 or telegram_username = $2)
          order by created_at desc
          limit 1
        `,
        [getCompanyId(), lead]
      );

      const leadRow = leadResult.rows[0];

      if (!leadRow?.id) {
        return {
          ok: false,
          mode: "live",
          message: "Не удалось найти сделку для назначения замера"
        };
      }

      const pool = getPool();
      const client = await pool.connect();
      const run = (text, params = []) => client.query(text, params);

      try {
        await run("begin");

        await run(
          `
            insert into appointments (
              company_id,
              lead_id,
              assigned_user_id,
              appointment_type,
              scheduled_at,
              duration_minutes,
              location,
              notes
            )
            values ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8)
          `,
          [
            getCompanyId(),
            leadRow.id,
            assignedUserId,
            type,
            scheduledAt,
            durationMinutes,
            location,
            note
          ]
        );

        if (leadRow.status !== "MEETING") {
          await run(
            `
              update leads
              set status = 'MEETING',
                  updated_at = now()
              where company_id = $1
                and id = $2
            `,
            [getCompanyId(), leadRow.id]
          );

          await run(
            `
              insert into lead_status_history (
                company_id,
                lead_id,
                previous_status,
                next_status,
                change_reason
              )
              values ($1, $2, $3, 'MEETING', $4)
            `,
            [getCompanyId(), leadRow.id, leadRow.status, "Назначен замер или встреча"]
          );
        }

        await logLeadEvent(
          getCompanyId(),
          leadRow.id,
          "appointment_created",
          {
            appointment_type: type,
            scheduled_at: scheduledAt,
            location,
            note
          },
          run
        );

        if (leadRow.status !== "MEETING") {
          await logLeadEvent(
            getCompanyId(),
            leadRow.id,
            "lead_workflow_updated",
            {
              previous_status: leadRow.status,
              next_status: "MEETING",
              next_action: "Подтвердить замер и подготовить клиента к выезду"
            },
            run
          );
        }

        invalidateRuntimeCache();

        await run("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return {
        ok: true,
        mode: "live",
        message: "Замер или встреча сохранены"
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Ошибка назначения замера: ${error.message}`
      };
    }
  }

  const mockLead = findMockLeadRecord(lead);

  if (!mockLead?.slug) {
    return {
      ok: false,
      mode: "mock",
      message: "Не удалось найти сделку для назначения замера"
    };
  }

  const appointmentId = createMockAppointmentId();
  const nextAppointments = await updateMockLeadCollection(mockLead.slug, "appointments", (items) => [
    ...items,
    {
      id: appointmentId,
      lead: mockLead.name,
      owner: owner || mockLead.manager || "Не назначен",
      type,
      status: "SCHEDULED",
      scheduledAt,
      duration: durationMinutes ? `${durationMinutes} минут` : "Не указана",
      location: location || mockLead.address || "Адрес уточняется",
      note: note || "Комментарий по замеру не добавлен",
      outcomeNote: "",
      revenueAmount: "",
      dimensionsSummary: "Размеры будут добавлены после выезда",
      measurementComment: note || "Комментарий замерщика пока не добавлен",
      measurementResult: "Замер ещё не проведён"
    }
  ]);

  if (!nextAppointments) {
    return {
      ok: false,
      mode: "mock",
      message: "Не удалось сохранить замер в mock-store"
    };
  }

  await writeMockLeadPatch(mockLead.slug, {
    status: "MEETING",
    nextAction: "Подтвердить замер и подготовить клиента к выезду",
    nextContactAt: scheduledAt,
    lastTouch: new Date().toLocaleString("ru-RU")
  });
  invalidateRuntimeCache();

  return {
    ok: true,
    mode: "mock",
    message: "Замер или встреча сохранены в локальный mock-store",
    preview: {
      id: appointmentId,
      slug: mockLead.slug,
      lead: mockLead.name,
      owner: owner || mockLead.manager || "Не назначен",
      type,
      scheduledAt
    }
  };
}

export async function updateAppointmentStatus(payload) {
  const id = payload.id?.trim();
  const status = payload.status?.trim() || "CONFIRMED";
  const note = payload.note?.trim() || null;
  const revenueAmount = payload.revenueAmount ? Number(payload.revenueAmount) : null;

  if (!id) {
    return {
      ok: false,
      message: "Нужен id записи"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const appointmentResult = await query(
        `
          select lead_id, status as previous_status
          from appointments
          where company_id = $1
            and id = $2
          limit 1
        `,
        [getCompanyId(), id]
      );

      const appointmentRow = appointmentResult.rows[0];

      if (!appointmentRow?.lead_id) {
        return {
          ok: false,
          mode: "live",
          message: "Запись не найдена"
        };
      }

      const pool = getPool();
      const client = await pool.connect();
      const run = (text, params = []) => client.query(text, params);

      try {
        await run("begin");

        await run(
          `
            update appointments
            set status = $2,
                outcome_note = coalesce($3, outcome_note),
                revenue_amount = coalesce($4, revenue_amount),
                confirmed_at = case when $2 = 'CONFIRMED' then now() else confirmed_at end,
                completed_at = case when $2 in ('COMPLETED', 'NO_SHOW', 'CANCELLED') then now() else completed_at end
            where company_id = $1
              and id = $5
          `,
          [getCompanyId(), status, note, revenueAmount, id]
        );

        await logLeadEvent(
          getCompanyId(),
          appointmentRow.lead_id,
          "appointment_status_updated",
          {
            status,
            note
          },
          run
        );

        await logLeadEvent(
          getCompanyId(),
          appointmentRow.lead_id,
          "appointment_followthrough_logged",
          {
            previous_status: appointmentRow.previous_status,
            status,
            note,
            revenue_amount: revenueAmount
          },
          run
        );

        if (status === "NO_SHOW") {
          await run(
            `
              update leads
              set status = 'CONTACTED',
                  updated_at = now()
              where company_id = $1
                and id = $2
            `,
            [getCompanyId(), appointmentRow.lead_id]
          );

          await run(
            `
              insert into lead_followups (
                company_id,
                lead_id,
                followup_type,
                scheduled_at,
                notes
              )
              values ($1, $2, 'call', now() + interval '1 day', $3)
            `,
            [
              getCompanyId(),
              appointmentRow.lead_id,
              note || "Клиент не вышел на замер, нужно быстро вернуть его в контакт"
            ]
          );

          await logLeadEvent(
            getCompanyId(),
            appointmentRow.lead_id,
            "lead_workflow_updated",
            {
              previous_status: "MEETING",
              next_status: "CONTACTED",
              next_action: "Связаться с клиентом и переназначить замер"
            },
            run
          );
        }

        if (status === "COMPLETED" && revenueAmount && revenueAmount > 0) {
          await run(
            `
              update leads
              set status = 'WON',
                  updated_at = now()
              where company_id = $1
                and id = $2
            `,
            [getCompanyId(), appointmentRow.lead_id]
          );

          await logLeadEvent(
            getCompanyId(),
            appointmentRow.lead_id,
            "lead_workflow_updated",
            {
              previous_status: "MEETING",
              next_status: "WON",
              next_action: "Visit completed and revenue captured"
            },
            run
          );
        }

        invalidateRuntimeCache();

        await run("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return {
        ok: true,
        mode: "live",
        message: "Статус замера обновлён"
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Ошибка обновления статуса замера: ${error.message}`
      };
    }
  }

  const mockLead = findMockLeadByAppointmentId(id);

  if (!mockLead?.slug) {
    return {
      ok: false,
      mode: "mock",
      message: "Не удалось найти замер в mock-store"
    };
  }

  const currentAppointment =
    buildMockAppointmentEntries().find((item) => item.id === id) || null;
  const nextAppointments = await updateMockLeadCollection(mockLead.slug, "appointments", (items) =>
    {
      let updated = false;
      const nextItems = items.map((item) => {
        if (item.id !== id) {
          return item;
        }

        updated = true;
        return {
          ...item,
          status,
          outcomeNote: note || item.outcomeNote || "",
          revenueAmount:
            revenueAmount !== null && Number.isFinite(revenueAmount)
              ? String(revenueAmount)
              : item.revenueAmount
        };
      });

      if (updated || !currentAppointment) {
        return nextItems;
      }

      return [
        ...nextItems,
        {
          id: currentAppointment.id,
          lead: currentAppointment.lead || mockLead.name,
          owner: currentAppointment.owner || mockLead.manager || "Не назначен",
          type: currentAppointment.type,
          status,
          scheduledAt: currentAppointment.scheduledAt,
          scheduledAtIso: currentAppointment.scheduledAtIso || null,
          duration: currentAppointment.duration || "Не указана",
          location: currentAppointment.location || currentAppointment.address || "Адрес уточняется",
          note: currentAppointment.note || "Комментарий по замеру не добавлен",
          outcomeNote: note || currentAppointment.outcomeNote || "",
          revenueAmount:
            revenueAmount !== null && Number.isFinite(revenueAmount)
              ? String(revenueAmount)
              : currentAppointment.revenueAmount || "",
          dimensionsSummary:
            currentAppointment.dimensionsSummary || "Размеры будут добавлены после выезда",
          measurementComment:
            currentAppointment.measurementComment ||
            currentAppointment.note ||
            "Комментарий замерщика пока не добавлен",
          measurementResult:
            currentAppointment.measurementResult ||
            currentAppointment.outcomeNote ||
            "Результат замера ещё не зафиксирован"
        }
      ];
    }
  );

  if (!nextAppointments) {
    return {
      ok: false,
      mode: "mock",
      message: "Не удалось обновить замер в mock-store"
    };
  }

  const workflowPatch = {
    lastTouch: new Date().toLocaleString("ru-RU")
  };

  if (status === "NO_SHOW") {
    workflowPatch.status = "CONTACTED";
    workflowPatch.nextAction = "Связаться с клиентом и переназначить замер";
  }

  if (status === "COMPLETED") {
    workflowPatch.status = revenueAmount && revenueAmount > 0 ? "WON" : mockLead.status;
    workflowPatch.nextAction =
      revenueAmount && revenueAmount > 0
        ? "Заказ подтверждён, готовим запуск"
        : "Подготовить расчёт и следующий шаг";
  }

  await writeMockLeadPatch(mockLead.slug, workflowPatch);
  invalidateRuntimeCache();

  return {
    ok: true,
    mode: "mock",
    message: "Статус замера обновлён в локальном mock-store",
    preview: {
      id,
      status,
      note,
      revenueAmount
    }
  };
}

export async function sendAppointmentReminder(payload) {
  const id = payload.id?.trim();

  if (!id) {
    return {
      ok: false,
      message: "Нужен идентификатор замера"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const result = await query(
        `
          select
            a.id,
            a.lead_id,
            a.appointment_type,
            a.scheduled_at,
            a.location,
            coalesce(l.full_name, l.telegram_username, 'РєР»РёРµРЅС‚') as lead_name,
            lc.external_chat_id
          from appointments a
          join leads l on l.id = a.lead_id
          left join lead_conversations lc
            on lc.lead_id = l.id
           and lc.channel = 'telegram'
          where a.company_id = $1
            and a.id = $2
          order by lc.created_at desc nulls last
          limit 1
        `,
        [getCompanyId(), id]
      );

      const row = result.rows[0];

      if (!row?.lead_id) {
        return {
          ok: false,
          mode: "live",
          message: "Замер не найден"
        };
      }

      if (!row.external_chat_id) {
        return {
          ok: false,
          mode: "live",
          message: "По замеру нет Telegram-канала для напоминания"
        };
      }

      const scheduledText = row.scheduled_at
        ? new Date(row.scheduled_at).toLocaleString("ru-RU")
        : "уточняется";
      const messageText = [
        `Напоминание по замеру для ${row.lead_name}.`,
        `Формат: ${getAppointmentTypeLabel(row.appointment_type)}.`,
        `Время: ${scheduledText}.`,
        row.location ? `Адрес: ${row.location}.` : null
      ]
        .filter(Boolean)
        .join("\n");

      await sendTelegramBotMessage(row.external_chat_id, messageText);

      await logLeadEvent(getCompanyId(), row.lead_id, "appointment_reminder_sent", {
        appointment_id: id,
        message_text: messageText
      });

      invalidateRuntimeCache();

      return {
        ok: true,
        mode: "live",
        message: "Напоминание отправлено"
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Ошибка отправки напоминания: ${error.message}`
      };
    }
  }

  return {
    ok: true,
    mode: "mock",
    message: "Напоминание отправлено в mock-режиме",
    preview: { id }
  };
}

export async function sendAppointmentTemplateMessage(payload) {
  const appointmentId = payload.id?.trim();
  const templateKey = payload.templateKey?.trim();

  if (!appointmentId || !templateKey) {
    return {
      ok: false,
      message: "Нужны идентификатор замера и ключ шаблона"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const appointmentResult = await query(
        `
          select
            a.id,
            a.lead_id,
            a.appointment_type,
            a.status as appointment_status,
            a.scheduled_at,
            a.location,
            a.notes,
            coalesce(l.full_name, l.telegram_username, 'Клиент без имени') as lead_name,
            l.status as lead_status,
            l.channel,
            l.source,
            coalesce(u.full_name, 'Не назначен') as manager_name,
            lc.id as conversation_id,
            lc.external_chat_id
          from appointments a
          join leads l on l.id = a.lead_id
          left join users u on u.id = l.assigned_user_id
          left join lead_conversations lc
            on lc.lead_id = l.id
           and lc.channel = 'telegram'
          where a.company_id = $1
            and a.id = $2
          order by lc.created_at desc nulls last
          limit 1
        `,
        [getCompanyId(), appointmentId]
      );

      const row = appointmentResult.rows[0];

      if (!row?.lead_id || !row?.external_chat_id) {
        return {
          ok: false,
          mode: "live",
          message: "Не удалось найти замер или Telegram-диалог"
        };
      }

      const lead = {
        slug: row.lead_id,
        name: row.lead_name,
        channel: row.channel || "telegram",
        source: row.source || "не указан",
        status: row.lead_status || "CONTACTED",
        manager: row.manager_name,
        summary: row.notes || "",
        nextAction: "Проверить следующий шаг",
        messages: [],
        followups: [],
        appointments: [
          {
            id: row.id,
            type: row.appointment_type,
            status: row.appointment_status,
            scheduledAt: row.scheduled_at
              ? new Date(row.scheduled_at).toLocaleString("ru-RU")
              : "Не назначено",
            location: row.location || "Адрес уточняется"
          }
        ]
      };

      const template = getTelegramReplyTemplateByKey(lead, templateKey);

      if (!template?.text) {
        return {
          ok: false,
          mode: "live",
          message: "Не удалось подобрать шаблон сообщения"
        };
      }

      const telegramMessage = await sendTelegramBotMessage(
        row.external_chat_id,
        template.text
      );

      const pool = getPool();
      const client = await pool.connect();
      const run = (text, params = []) => client.query(text, params);

      try {
        await run("begin");

        await run(
          `
            update lead_conversations
            set last_message_at = now()
            where id = $1
          `,
          [row.conversation_id]
        );

        await run(
          `
            insert into lead_messages (
              company_id,
              lead_id,
              conversation_id,
              direction,
              sender_type,
              external_message_id,
              message_text,
              raw_payload
            )
            values ($1, $2, $3, 'outbound', 'manager', $4, $5, $6::jsonb)
          `,
          [
            getCompanyId(),
            row.lead_id,
            row.conversation_id,
            String(telegramMessage.message_id || ""),
            template.text,
            JSON.stringify(telegramMessage)
          ]
        );

        await logLeadEvent(
          getCompanyId(),
          row.lead_id,
          "appointment_template_sent",
          {
            template_key: templateKey,
            appointment_id: appointmentId,
            appointment_status: row.appointment_status,
            message_text: template.text
          },
          run
        );

        invalidateRuntimeCache();

        await run("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return {
        ok: true,
        mode: "live",
        message: `Шаблон ${template.label} отправлен в Telegram`
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Ошибка отправки шаблона: ${error.message}`
      };
    }
  }

  return {
    ok: true,
    mode: "mock",
    message: "Шаблонное сообщение отправлено в mock-режиме",
    preview: {
      appointmentId,
      templateKey
    }
  };
}

export async function findTelegramClientLead(payload = {}) {
  const lead = findMockLeadByTelegramClientReference(payload);

  if (!lead?.slug) {
    return null;
  }

  return getLeadBySlug(lead.slug);
}

export async function createTelegramClientLead(payload = {}) {
  const name = payload.name?.trim();
  const phone = payload.phone?.trim();
  const product = payload.product?.trim();

  if (!name || !phone || !product) {
    return {
      ok: false,
      mode: "mock",
      message: "Для создания заявки нужны имя, телефон и изделие."
    };
  }

  const existingLead = findMockLeadByTelegramClientReference({
    chatId: payload.chatId,
    telegramUserId: payload.telegramUserId,
    username: payload.username,
    reference: phone
  });

  if (existingLead?.slug) {
    return {
      ok: true,
      mode: "mock",
      message: "Заявка уже есть в CRM.",
      lead: await getLeadBySlug(existingLead.slug),
      created: false
    };
  }

  const nextLead = buildTelegramClientLeadRecord(payload);
  const currentExtraLeads = getMockExtraLeads();
  currentExtraLeads.push(nextLead);
  getMockExtraLeads();
  await persistMockExtraLeads();
  invalidateRuntimeCache();

  return {
    ok: true,
    mode: "mock",
    message: "Клиентская заявка сохранена в CRM.",
    lead: await getLeadBySlug(nextLead.slug),
    created: true
  };
}

export async function createFollowup(payload) {
  const lead = payload.lead?.trim();
  const owner = payload.owner?.trim() || "Не назначен";
  const type = payload.type?.trim() || "custom";
  const scheduledAt = payload.scheduledAt?.trim();
  const note = payload.note?.trim() || "Без комментария";

  if (!lead || !scheduledAt) {
    return {
      ok: false,
      message: "Нужно указать клиента и дату следующего контакта"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const leadResult = await query(
        `
          select id
          from leads
          where company_id = $1
            and (full_name = $2 or telegram_username = $2)
          order by created_at desc
          limit 1
        `,
        [getCompanyId(), lead]
      );

      if (!leadResult.rows[0]) {
        return {
          ok: false,
          mode: "live",
          message: "Не удалось найти сделку для следующего контакта"
        };
      }

      await query(
        `
          insert into lead_followups (
            company_id,
            lead_id,
            followup_type,
            scheduled_at,
            notes
          )
          values ($1, $2, $3, $4::timestamptz, $5)
        `,
        [getCompanyId(), leadResult.rows[0].id, type, scheduledAt, note]
      );

      await logLeadEvent(getCompanyId(), leadResult.rows[0].id, "followup_created", {
        owner,
        followup_type: type,
        scheduled_at: scheduledAt,
        note
      });

      invalidateRuntimeCache();

      return {
        ok: true,
        mode: "live",
        message: "Следующий контакт сохранён в базе"
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Ошибка создания следующего контакта: ${error.message}`
      };
    }
  }

  const mockLead = findMockLeadRecord(lead);

  if (!mockLead?.slug) {
    return {
      ok: false,
      mode: "mock",
      message: "Не удалось найти сделку для следующего контакта"
    };
  }

  const typeKey = inferFollowupTypeKey(type);
  const followupLabel =
    /^[a-z_]+$/i.test(type) ? formatFollowupTypeLabel(typeKey) : type || "Следующий контакт";
  const nextFollowups = await updateMockLeadCollection(mockLead.slug, "followups", (items) => [
    ...items,
    {
      id: `${mockLead.slug}-followup-${items.length + 1}`,
      type: followupLabel,
      typeKey,
      owner: owner || mockLead.manager || "Не назначен",
      scheduledAt,
      note,
      status: "PENDING"
    }
  ]);

  if (!nextFollowups) {
    return {
      ok: false,
      mode: "mock",
      message: "Не удалось сохранить следующий контакт в mock-store"
    };
  }

  await writeMockLeadPatch(mockLead.slug, {
    nextContactAt: scheduledAt,
    nextAction: note || "Вернуться к клиенту в назначенное время",
    lastTouch: new Date().toLocaleString("ru-RU")
  });
  invalidateRuntimeCache();

  return {
    ok: true,
    mode: "mock",
    message: "Следующий контакт сохранён в локальный mock-store",
    preview: {
      slug: mockLead.slug,
      lead: mockLead.name,
      owner: owner || mockLead.manager || "Не назначен",
      type: followupLabel,
      typeKey,
      scheduledAt
    }
  };
}

export async function createTask(payload) {
  const title = payload.title?.trim();
  const lead = payload.lead?.trim() || null;
  const owner = payload.owner?.trim() || null;
  const deadline = payload.deadline || null;
  const priority = payload.priority || "medium";
  const description = payload.description?.trim() || null;

  if (!title) {
    return {
      ok: false,
      message: "РќСѓР¶РЅРѕ РїРµСЂРµРґР°С‚СЊ title Р·Р°РґР°С‡Рё"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      let assignedUserId = null;
      let leadId = null;

      if (owner) {
        const userResult = await query(
          `
            select id
            from users
            where company_id = $1
              and full_name = $2
            limit 1
          `,
          [getCompanyId(), owner]
        );

        assignedUserId = userResult.rows[0]?.id || null;
      }

      if (lead) {
        const leadResult = await query(
          `
            select id
            from leads
            where company_id = $1
              and (
                full_name = $2
                or telegram_username = $2
              )
            limit 1
          `,
          [getCompanyId(), lead]
        );

        leadId = leadResult.rows[0]?.id || null;
      }

      await query(
        `
          insert into tasks (
            company_id,
            lead_id,
            assigned_user_id,
            title,
            description,
            priority,
            due_at
          )
          values ($1, $2, $3, $4, $5, $6, $7::timestamptz)
        `,
        [
          getCompanyId(),
          leadId,
          assignedUserId,
          title,
          description,
          priority,
          deadline
        ]
      );

      if (leadId) {
        await logLeadEvent(getCompanyId(), leadId, "task_created", {
          title,
          owner,
          priority,
          deadline,
          description
        });
      }

      invalidateRuntimeCache();

      return {
        ok: true,
        mode: "live",
        message: "Р—Р°РґР°С‡Р° СЃРѕС…СЂР°РЅРµРЅР° РІ Р±Р°Р·Рµ"
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ Р·Р°РґР°С‡Рё: ${error.message}`
      };
    }
  }

  return {
    ok: true,
    mode: "mock",
    message: "Р—Р°РґР°С‡Р° СЃРѕР·РґР°РЅР° РІ mock-СЂРµР¶РёРјРµ",
    preview: {
      title,
      lead,
      owner,
      deadline,
      priority,
      description
    }
  };
}

export async function completeFollowup(payload) {
  const lead = payload.lead?.trim();
  const slug = payload.slug?.trim() || null;
  const requestedType = payload.type?.trim() || payload.typeKey?.trim() || "";
  const type = inferFollowupTypeKey(requestedType);
  const scheduledAt = payload.scheduledAt?.trim();
  const note = payload.note?.trim() || null;

  if ((!lead && !slug) || !type) {
    return {
      ok: false,
      message: "Нужно передать клиента и тип следующего контакта"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const result = await query(
        `
          update lead_followups f
          set status = 'DONE'
          from leads l
          where f.company_id = $1
            and l.company_id = $1
            and f.lead_id = l.id
            and ($2::text is null or l.id = $2)
            and ($3::text is null or coalesce(l.full_name, l.telegram_username, '') = $3)
            and f.followup_type = $4
            and f.status = 'PENDING'
          returning f.id, f.lead_id
        `,
        [getCompanyId(), slug, lead || null, type]
      );

      if (!result.rows[0]) {
        return {
          ok: false,
          mode: "live",
          message: "Активный следующий контакт не найден"
        };
      }

      await logLeadEvent(getCompanyId(), result.rows[0].lead_id, "followup_completed", {
        lead,
        followup_type: type,
        scheduled_at: scheduledAt || null,
        executor_note: note
      });

      invalidateRuntimeCache();

      return {
        ok: true,
        mode: "live",
        message: "Следующий контакт закрыт"
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Ошибка завершения следующего контакта: ${error.message}`
      };
    }
  }

  const mockLead = slug ? findMockLeadRecord(slug) : findMockLeadRecord(lead);

  if (!mockLead?.slug) {
    return {
      ok: false,
      mode: "mock",
      message: "Не удалось найти следующий контакт в mock-store"
    };
  }

  let completed = false;
  const nextFollowups = await updateMockLeadCollection(mockLead.slug, "followups", (items) =>
    items.map((item) => {
      if (completed || String(item.status || "PENDING") !== "PENDING") {
        return item;
      }

      const itemTypeKey = item.typeKey || inferFollowupTypeKey(item.type);
      const scheduledMatches = !scheduledAt || item.scheduledAt === scheduledAt;

      if (itemTypeKey !== type || !scheduledMatches) {
        return item;
      }

      completed = true;
      return {
        ...item,
        typeKey: itemTypeKey,
        status: "DONE",
        completedNote: note || item.completedNote || ""
      };
    })
  );

  if (!nextFollowups || !completed) {
    return {
      ok: false,
      mode: "mock",
      message: "Активный следующий контакт не найден в mock-store"
    };
  }

  const nextPending = nextFollowups.find((item) => String(item.status) === "PENDING");

  await writeMockLeadPatch(mockLead.slug, {
    nextContactAt: nextPending?.scheduledAt || "Не назначен",
    lastTouch: new Date().toLocaleString("ru-RU")
  });
  invalidateRuntimeCache();

  return {
    ok: true,
    mode: "mock",
    message: "Следующий контакт закрыт в локальном mock-store",
    preview: {
      lead: mockLead.name,
      slug: mockLead.slug,
      type,
      scheduledAt,
      note
    }
  };
}

export async function completeTask(payload) {
  const title = payload.title?.trim();
  const note = payload.note?.trim() || null;

  if (!title) {
    return {
      ok: false,
      message: "Нужно передать название задачи"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const result = await query(
        `
          update tasks
          set status = 'DONE',
              completed_at = now()
          where company_id = $1
            and title = $2
            and status = 'OPEN'
          returning id, lead_id
        `,
        [getCompanyId(), title]
      );

      if (!result.rows[0]) {
        return {
          ok: false,
          mode: "live",
          message: "Открытая задача не найдена"
        };
      }

      if (result.rows[0].lead_id) {
        await logLeadEvent(getCompanyId(), result.rows[0].lead_id, "task_completed", {
          title,
          executor_note: note
        });
      }

      invalidateRuntimeCache();

      return {
        ok: true,
        mode: "live",
        message: "Задача закрыта"
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `Ошибка закрытия задачи: ${error.message}`
      };
    }
  }

  return {
    ok: true,
    mode: "mock",
    message: "Задача закрыта в mock-режиме",
    preview: { title, note }
  };
}

export async function sendLeadTelegramReply(slug, payload) {
  const messageText = payload.messageText?.trim() || "";
  const templateKey = payload.templateKey?.trim() || null;

  if (!slug || !messageText) {
    return {
      ok: false,
      message: "РќСѓР¶РЅС‹ lead slug Рё С‚РµРєСЃС‚ СЃРѕРѕР±С‰РµРЅРёСЏ"
    };
  }

  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const [conversationResult, leadResult] = await Promise.all([
        query(
          `
            select id, external_chat_id
            from lead_conversations
            where company_id = $1
              and lead_id = $2
              and channel = 'telegram'
            order by created_at desc
            limit 1
          `,
          [getCompanyId(), slug]
        ),
        query(
          `
            select status
            from leads
            where company_id = $1
              and id = $2
            limit 1
          `,
          [getCompanyId(), slug]
        )
      ]);

      const conversation = conversationResult.rows[0];
      const previousStatus = leadResult.rows[0]?.status || null;

      if (!conversation?.external_chat_id) {
        return {
          ok: false,
          mode: "live",
          message: "РЈ Р»РёРґР° РЅРµС‚ Р°РєС‚РёРІРЅРѕРіРѕ Telegram conversation"
        };
      }

      const telegramMessage = await sendTelegramBotMessage(
        conversation.external_chat_id,
        messageText
      );

      const pool = getPool();
      const client = await pool.connect();
      const run = (text, params = []) => client.query(text, params);

      try {
        await run("begin");

        await run(
          `
            update lead_conversations
            set last_message_at = now()
            where id = $1
          `,
          [conversation.id]
        );

        await run(
          `
            insert into lead_messages (
              company_id,
              lead_id,
              conversation_id,
              direction,
              sender_type,
              external_message_id,
              message_text,
              raw_payload
            )
            values ($1, $2, $3, 'outbound', 'manager', $4, $5, $6::jsonb)
          `,
          [
            getCompanyId(),
            slug,
            conversation.id,
            String(telegramMessage.message_id || ""),
            messageText,
            JSON.stringify(telegramMessage)
          ]
        );

        if (previousStatus === "NEW") {
          await run(
            `
              update leads
              set status = 'CONTACTED',
                  updated_at = now()
              where company_id = $1
                and id = $2
            `,
            [getCompanyId(), slug]
          );

          await run(
            `
              insert into lead_status_history (
                company_id,
                lead_id,
                previous_status,
                next_status,
                change_reason
              )
              values ($1, $2, $3, 'CONTACTED', $4)
            `,
            [getCompanyId(), slug, previousStatus, "Manager replied in Telegram"]
          );

          await logLeadEvent(
            getCompanyId(),
            slug,
            "lead_workflow_updated",
            {
              previous_status: previousStatus,
              next_status: "CONTACTED",
              next_action: "Manager replied in Telegram"
            },
            run
          );
        }

        const completedTasksResult = await run(
          `
            update tasks
            set status = 'DONE',
                completed_at = now()
            where company_id = $1
              and lead_id = $2
              and status = 'OPEN'
              and title = 'РџРµСЂРІС‹Р№ РєРѕРЅС‚Р°РєС‚ СЃ Р»РёРґРѕРј'
            returning title
          `,
          [getCompanyId(), slug]
        );

        for (const row of completedTasksResult.rows) {
          await logLeadEvent(
            getCompanyId(),
            slug,
            "task_completed",
            {
              title: row.title,
              executor_note: "Auto-closed after manager Telegram reply"
            },
            run
          );
        }

        await logLeadEvent(
          getCompanyId(),
          slug,
          "manager_reply_sent",
          {
            channel: "telegram",
            message_text: messageText,
            template_key: templateKey
          },
          run
        );

        invalidateRuntimeCache();

        await run("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return {
        ok: true,
        mode: "live",
        message: "РЎРѕРѕР±С‰РµРЅРёРµ РѕС‚РїСЂР°РІР»РµРЅРѕ РІ Telegram"
      };
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        message: `РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё РІ Telegram: ${error.message}`
      };
    }
  }

  return {
    ok: true,
    mode: "mock",
    message: "Telegram reply РѕС‚СЂР°Р±РѕС‚Р°Р» РІ mock-СЂРµР¶РёРјРµ",
    preview: {
      slug,
      messageText,
      templateKey
    }
  };
}

export async function getLeadTelegramReplyDraft(slug) {
  const lead = await getLeadBySlug(slug);

  if (!lead) {
    return {
      ok: false,
      message: "Не удалось найти лида для reply draft"
    };
  }

  const suggestion = suggestTelegramReplyDraft(lead);

  if (!suggestion.template) {
    return {
      ok: false,
      message: "Не удалось подобрать шаблон для reply draft"
    };
  }

  return {
    ok: true,
    templateKey: suggestion.template.key,
    label: suggestion.template.label,
    messageText: suggestion.template.text,
    reason: suggestion.reason
  };
}

export async function getLeadTelegramAIReplyDraft(slug) {
  const lead = await getLeadBySlug(slug);

  if (!lead) {
    return {
      ok: false,
      message: "Не удалось найти лида для AI draft"
    };
  }

  const result = await getAILeadReplyDraft(lead);

  if (!result.ok) {
    return {
      ok: false,
      message: result.message || "Не удалось собрать AI draft"
    };
  }

  return result;
}

export async function getWorkboardData(role = "owner") {
  try {
    const normalizedRole =
      role === "manager" || role === "operator" ? role : "owner";

    const [dashboard, tasks, followups, activity] = await Promise.all([
      getDashboardData(),
      getTasksData(),
      getFollowupsData(),
      getActivityData()
    ]);

    const flatTasks = flattenTaskColumns(tasks).filter((item) => {
      if (normalizedRole === "operator" && item.lane === "На дожим") {
        return false;
      }

      return true;
    });

    const filteredLeads = dashboard.queue.filter(() => true);
    const filteredFollowups = followups.filter(() => true);
    const filteredAlerts = activity.filter(() => true);

    const focus = [
      {
        label: "Первый контакт",
        value: String(filteredLeads.filter((item) => item.status === "NEW").length),
        note: "Заявки, по которым менеджер ещё не вышел на связь"
      },
      {
        label: "Срочные задачи",
        value: String(flatTasks.filter((item) => item.lane === "Срочно").length),
        note: "Действия, которые нельзя упустить в текущей смене"
      },
      {
        label: "Следующие контакты",
        value: String(filteredFollowups.length),
        note: "Возвраты после расчёта, замера и согласования"
      },
      {
        label: "Контрольные сигналы",
        value: String(filteredAlerts.length),
        note:
          normalizedRole === "owner"
            ? "События, где собственнику важно быстро включиться"
            : "События, которые важны для текущей смены"
      }
    ];

    const mapLeadLink = (item) => ({
      ...item,
      slug:
        item.slug ||
        findMockLeadSlug(item.lead || item.title || item.note || item.action || item.detail)
    });

    if (!filteredLeads.length && !flatTasks.length && !filteredFollowups.length) {
      return buildStaticWorkboardData();
    }

    return {
      focus,
      urgentLeads: filteredLeads.slice(0, 5).map(mapLeadLink),
      taskQueue: flatTasks.slice(0, 6).map(mapLeadLink),
      followups: filteredFollowups.slice(0, 6).map(mapLeadLink),
      alerts: filteredAlerts.slice(0, 6).map(mapLeadLink)
    };
  } catch (error) {
    console.warn("Workboard mock data fallback:", error.message);
    return buildStaticWorkboardData();
  }
}

export async function getActivityData() {
  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const result = await query(
        `
          select
            e.created_at,
            coalesce(u.full_name, 'РЎРёСЃС‚РµРјР°') as actor_name,
            l.id as lead_id,
            coalesce(l.full_name, l.telegram_username, 'Р‘РµР· РёРјРµРЅРё') as lead_name,
            e.event_type,
            e.payload
          from lead_events e
          left join users u on u.id = e.actor_user_id
          left join leads l on l.id = e.lead_id
          where e.company_id = $1
          order by e.created_at desc
          limit 50
        `,
        [getCompanyId()]
      );

      return result.rows.map((row) => ({
        slug: row.lead_id || null,
        time: new Date(row.created_at).toLocaleString("ru-RU"),
        actor: row.actor_name,
        lead: row.lead_name,
        action: formatLeadEventAction(row.event_type),
        detail: formatLeadEventDetail(row.event_type, row.payload || {})
      }));
    } catch (error) {
      console.warn("Activity live data fallback:", error.message);
    }
  }

  return clone(activityLog);
}

export async function getAnalyticsData() {
  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const [
        sourceResult,
        lossResult,
        managerResult,
        bookingSummaryResult,
        bookingPerformanceResult
      ] = await Promise.all([
        query(
          `
            select
              coalesce(source, 'unknown') as source,
              count(*) as leads,
              count(*) filter (where status = 'WON') as won,
              count(*) filter (where status = 'LOST') as lost,
              avg(lead_cost) as avg_cpl
            from leads
            where company_id = $1
            group by source
            order by count(*) desc
          `,
          [getCompanyId()]
        ),
        query(
          `
            select
              coalesce(payload->>'loss_reason', 'РќРµ СѓРєР°Р·Р°РЅРѕ') as reason,
              count(*) as total
            from lead_events
            where company_id = $1
              and event_type = 'lead_lost_reason_saved'
            group by coalesce(payload->>'loss_reason', 'РќРµ СѓРєР°Р·Р°РЅРѕ')
            order by count(*) desc
          `,
          [getCompanyId()]
        ),
        query(
          `
            select
              coalesce(u.full_name, 'РќРµ РЅР°Р·РЅР°С‡РµРЅ') as manager,
              count(*) filter (where l.status = 'WON') as won,
              count(*) filter (where l.status = 'NEW') as still_new,
              count(*) filter (where t.status = 'OPEN' and t.due_at < now()) as overdue
            from users u
            left join leads l on l.assigned_user_id = u.id and l.company_id = $1
            left join tasks t on t.assigned_user_id = u.id and t.company_id = $1
            where u.company_id = $1
              and u.role in ('manager', 'owner')
            group by u.full_name
            order by won desc, overdue asc
          `,
          [getCompanyId()]
        ),
        query(
          `
            select
              count(*) filter (where status in ('SCHEDULED', 'CONFIRMED')) as active_bookings,
              count(*) filter (where status = 'CONFIRMED') as confirmed_bookings,
              count(*) filter (where status = 'NO_SHOW') as no_show_bookings,
              coalesce(sum(revenue_amount) filter (where status = 'COMPLETED'), 0) as completed_revenue
            from appointments
            where company_id = $1
          `,
          [getCompanyId()]
        ),
        query(
          `
            select
              coalesce(u.full_name, 'Не назначен') as owner_name,
              count(*) filter (where a.status = 'SCHEDULED') as scheduled,
              count(*) filter (where a.status = 'CONFIRMED') as confirmed,
              count(*) filter (where a.status = 'NO_SHOW') as no_show,
              count(*) filter (where a.status = 'COMPLETED') as completed,
              coalesce(sum(a.revenue_amount) filter (where a.status = 'COMPLETED'), 0) as revenue
            from appointments a
            left join users u on u.id = a.assigned_user_id
            where a.company_id = $1
            group by coalesce(u.full_name, 'Не назначен')
            order by revenue desc, completed desc, confirmed desc
          `,
          [getCompanyId()]
        )
      ]);
      const bookingSummary = bookingSummaryResult.rows[0] || {};
      const formatMoney = (value) =>
        `${new Intl.NumberFormat("ru-RU", {
          maximumFractionDigits: 0
        }).format(Number(value || 0))} ₸`;

      return {
        bookingSummary: [
          {
            label: "Записи в работе",
            value: String(bookingSummary.active_bookings || 0),
            note: "Слоты, которые команда ещё ведёт к визиту"
          },
          {
            label: "Подтверждено",
            value: String(bookingSummary.confirmed_bookings || 0),
            note: "Клиенты подтвердили приход или созвон"
          },
          {
            label: "No-show",
            value: String(bookingSummary.no_show_bookings || 0),
            note: "Сигнал на возврат клиента в follow-up"
          },
          {
            label: "Выручка по визитам",
            value: formatMoney(bookingSummary.completed_revenue),
            note: "По завершённым встречам и процедурам"
          }
        ],
        bookingPerformance: bookingPerformanceResult.rows.map((row) => ({
          owner: row.owner_name,
          scheduled: Number(row.scheduled || 0),
          confirmed: Number(row.confirmed || 0),
          noShow: Number(row.no_show || 0),
          completed: Number(row.completed || 0),
          revenue: formatMoney(row.revenue)
        })),
        sourcePerformance: sourceResult.rows.map((row) => ({
          source: row.source,
          leads: Number(row.leads || 0),
          won: Number(row.won || 0),
          lost: Number(row.lost || 0),
          cpl: row.avg_cpl ? `$${Number(row.avg_cpl).toFixed(1)}` : "n/a",
          note: "Live"
        })),
        lossReasons: lossResult.rows.map((row) => ({
          reason: row.reason,
          total: Number(row.total || 0)
        })),
        managerQuality: managerResult.rows.map((row) => ({
          manager: row.manager,
          firstResponse: "Live",
          overdue: Number(row.overdue || 0),
          won: Number(row.won || 0),
          note:
            Number(row.still_new || 0) > 0
              ? `Есть ${row.still_new} лидов в NEW`
              : "Поток под контролем"
        }))
      };
    } catch (error) {
      console.warn("Analytics live data fallback:", error.message);
    }
  }

  return clone(analyticsSnapshot);
}

export async function getEscalationsData() {
  if (isLiveDatabaseEnabled() && getCompanyId()) {
    try {
      const companyId = getCompanyId();
      const [
        firstResponseResult,
        followupResult,
        tasksResult,
        stalledResult
      ] = await Promise.all([
        query(
          `
            select
              l.id,
              coalesce(l.full_name, l.telegram_username, 'No name') as lead_name,
              coalesce(u.full_name, 'Unassigned') as owner_name,
              l.source,
              l.status,
              l.first_response_due_at
            from leads l
            left join users u on u.id = l.assigned_user_id
            where l.company_id = $1
              and l.status = 'NEW'
              and l.first_response_due_at is not null
              and l.first_response_due_at < now()
            order by l.first_response_due_at asc
            limit 20
          `,
          [companyId]
        ),
        query(
          `
            select
              l.id,
              coalesce(l.full_name, l.telegram_username, 'No name') as lead_name,
              coalesce(u.full_name, 'Unassigned') as owner_name,
              f.followup_type,
              f.scheduled_at,
              f.notes
            from lead_followups f
            left join leads l on l.id = f.lead_id
            left join users u on u.id = f.assigned_user_id
            where f.company_id = $1
              and f.status = 'PENDING'
              and f.scheduled_at < now()
            order by f.scheduled_at asc
            limit 20
          `,
          [companyId]
        ),
        query(
          `
            select
              t.title,
              coalesce(u.full_name, 'Unassigned') as owner_name,
              t.due_at,
              t.priority
            from tasks t
            left join users u on u.id = t.assigned_user_id
            where t.company_id = $1
              and t.status = 'OPEN'
              and t.due_at is not null
              and t.due_at < now()
            order by t.due_at asc
            limit 20
          `,
          [companyId]
        ),
        query(
          `
            select
              l.id,
              coalesce(l.full_name, l.telegram_username, 'No name') as lead_name,
              coalesce(u.full_name, 'Unassigned') as owner_name,
              l.status,
              l.updated_at
            from leads l
            left join users u on u.id = l.assigned_user_id
            where l.company_id = $1
              and l.status in ('QUALIFIED', 'MEETING', 'PROPOSAL')
              and l.updated_at < now() - interval '24 hours'
            order by l.updated_at asc
            limit 20
          `,
          [companyId]
        )
      ]);

      return {
        summary: [
          {
            label: "First Response Breaches",
            value: String(firstResponseResult.rows.length),
            note: "New leads already outside the first-reply SLA"
          },
          {
            label: "Overdue Follow-ups",
            value: String(followupResult.rows.length),
            note: "Callbacks and nudges that should have happened already"
          },
          {
            label: "Overdue Tasks",
            value: String(tasksResult.rows.length),
            note: "Operational tasks blocking revenue movement"
          },
          {
            label: "Stalled Leads",
            value: String(stalledResult.rows.length),
            note: "Qualified leads with no recent movement"
          }
        ],
        firstResponseBreaches: firstResponseResult.rows.map((row) => ({
          slug: row.id,
          lead: row.lead_name,
          owner: row.owner_name,
          source: row.source || "Unknown",
          status: normalizeLeadStatus(row.status),
          deadline: row.first_response_due_at
            ? new Date(row.first_response_due_at).toLocaleString("ru-RU")
            : "No deadline"
        })),
        overdueFollowups: followupResult.rows.map((row) => ({
          slug: row.id,
          lead: row.lead_name,
          owner: row.owner_name,
          type: row.followup_type,
          scheduledAt: row.scheduled_at
            ? new Date(row.scheduled_at).toLocaleString("ru-RU")
            : "TBD",
          note: row.notes || "No note"
        })),
        overdueTasks: tasksResult.rows.map((row) => ({
          title: row.title,
          owner: row.owner_name,
          deadline: row.due_at
            ? new Date(row.due_at).toLocaleString("ru-RU")
            : "No deadline",
          tag: row.priority || "medium"
        })),
        stalledLeads: stalledResult.rows.map((row) => ({
          slug: row.id,
          lead: row.lead_name,
          owner: row.owner_name,
          status: normalizeLeadStatus(row.status),
          lastTouch: row.updated_at
            ? new Date(row.updated_at).toLocaleString("ru-RU")
            : "No data"
        }))
      };
    } catch (error) {
      console.warn("Escalations live data fallback:", error.message);
    }
  }

  return clone(escalationSnapshot);
}

export async function getSystemReadinessData() {
  const config = getDatabaseConfigState();
  const database = await checkDatabaseHealth();

  return {
    appMode: database.ok ? "live" : "mock",
    database,
    env: {
      companyId: Boolean(getCompanyId()),
      postgresHost: config.hasHost,
      postgresDatabase: config.hasDatabase,
      postgresUser: config.hasUser,
      postgresPassword: config.hasPassword,
      postgresSsl: config.sslEnabled
    },
    notes: [
      database.ok
        ? "РџР°РЅРµР»СЊ РјРѕР¶РµС‚ С‡РёС‚Р°С‚СЊ live-РґР°РЅРЅС‹Рµ РёР· Р±Р°Р·С‹."
        : "РџР°РЅРµР»СЊ СЃРµР№С‡Р°СЃ СЂР°Р±РѕС‚Р°РµС‚ С‡РµСЂРµР· mock fallback.",
      "Р”Р»СЏ РїРµСЂРµС…РѕРґР° РІ СЂРµР°Р»СЊРЅС‹Р№ СЂРµР¶РёРј РЅСѓР¶РЅС‹ РІР°Р»РёРґРЅС‹Рµ env Рё РґРѕСЃС‚СѓРїРЅР°СЏ Р±Р°Р·Р°.",
      "РЎР»РµРґСѓСЋС‰РёР№ С€Р°Рі РїРѕСЃР»Рµ live DB вЂ” РїСЂРѕРіРѕРЅ Telegram workflow РЅР° СЂРµР°Р»СЊРЅРѕРј С‚РµСЃС‚РѕРІРѕРј Р»РёРґРµ."
    ]
  };
}

export async function getLiveLaunchReadinessData() {
  const base = await getSystemReadinessData();
  const env = base.env;
  const missingEnv = [];

  if (!env.companyId) {
    missingEnv.push("DISET_DEFAULT_COMPANY_ID");
  }

  if (!env.postgresHost) {
    missingEnv.push("POSTGRES_HOST");
  }

  if (!env.postgresDatabase) {
    missingEnv.push("POSTGRES_DATABASE");
  }

  if (!env.postgresUser) {
    missingEnv.push("POSTGRES_USER");
  }

  if (!env.postgresPassword) {
    missingEnv.push("POSTGRES_PASSWORD");
  }

  return {
    ...base,
    missingEnv,
    launchChecklist: [
      {
        label: "Р—Р°РїРѕР»РЅРёС‚СЊ .env.local",
        done: missingEnv.length === 0,
        detail:
          missingEnv.length === 0
            ? "Р’СЃРµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ СѓР¶Рµ Р·Р°РґР°РЅС‹."
            : `РќРµ С…РІР°С‚Р°РµС‚: ${missingEnv.join(", ")}`
      },
      {
        label: "РџСЂРѕРІРµСЂРёС‚СЊ РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє Postgres",
        done: base.database.ok,
        detail: base.database.message
      },
      {
        label: "РџСЂРѕРіРЅР°С‚СЊ app health-check",
        done: base.database.ok,
        detail: "РџРѕСЃР»Рµ env РјРѕР¶РЅРѕ Р·Р°РїСѓСЃС‚РёС‚СЊ npm run check:system"
      },
      {
        label: "РџРѕРґРєР»СЋС‡РёС‚СЊ Telegram Рё n8n",
        done: false,
        detail: "Р­С‚РѕС‚ С€Р°Рі РёРґС‘С‚ РїРѕСЃР»Рµ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅРѕР№ live-Р±Р°Р·С‹."
      }
    ]
  };
}

