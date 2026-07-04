export const SCENARIO_DRAFT_CATEGORIES = Object.freeze([
  {
    id: "clients_leads",
    labels: {
      en: "Clients and leads",
      ru: "Клиенты и заявки"
    }
  },
  {
    id: "sales",
    labels: {
      en: "Sales",
      ru: "Продажи"
    }
  },
  {
    id: "tasks_staff",
    labels: {
      en: "Tasks and team",
      ru: "Задачи и сотрудники"
    }
  },
  {
    id: "reminders",
    labels: {
      en: "Reminders",
      ru: "Напоминания"
    }
  },
  {
    id: "documents_files",
    labels: {
      en: "Documents and files",
      ru: "Документы и файлы"
    }
  },
  {
    id: "reports",
    labels: {
      en: "Reports",
      ru: "Отчеты"
    }
  },
  {
    id: "customer_support",
    labels: {
      en: "Customer support",
      ru: "Поддержка клиентов"
    }
  },
  {
    id: "other",
    labels: {
      en: "Other",
      ru: "Другое"
    }
  }
]);

export const SCENARIO_ORDER_CATEGORIES = Object.freeze([
  {
    id: "crm",
    labels: {
      en: "CRM",
      ru: "CRM"
    }
  },
  {
    id: "telegram",
    labels: {
      en: "Telegram",
      ru: "Telegram"
    }
  },
  {
    id: "ai",
    labels: {
      en: "AI",
      ru: "AI"
    }
  },
  {
    id: "automation",
    labels: {
      en: "Automation",
      ru: "Автоматизация"
    }
  },
  {
    id: "integration",
    labels: {
      en: "Integration",
      ru: "Интеграция"
    }
  },
  {
    id: "other",
    labels: {
      en: "Other",
      ru: "Другое"
    }
  }
]);

export const SCENARIO_TARGET_PLATFORMS = Object.freeze([
  {
    id: "telegram",
    labels: {
      en: "Telegram",
      ru: "Telegram"
    }
  },
  {
    id: "n8n",
    labels: {
      en: "n8n",
      ru: "n8n"
    }
  },
  {
    id: "web",
    labels: {
      en: "Web",
      ru: "Web"
    }
  },
  {
    id: "node_js",
    labels: {
      en: "Node.js",
      ru: "Node.js"
    }
  },
  {
    id: "python",
    labels: {
      en: "Python",
      ru: "Python"
    }
  },
  {
    id: "other",
    labels: {
      en: "Other",
      ru: "Другое"
    }
  }
]);

export const SCENARIO_DRAFT_STATUSES = Object.freeze([
  "NEW",
  "REVIEW",
  "EXPORTED",
  "PROCESSING",
  "READY",
  "REJECTED"
]);

function normalizeText(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[@._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackLabel(lang) {
  return lang === "ru" ? "Другое" : "Other";
}

function findInCatalog(catalog, input) {
  const normalized = normalizeLookupText(input);

  if (!normalized) {
    return null;
  }

  return (
    catalog.find((entry) => {
      const id = normalizeLookupText(entry.id);
      const ru = normalizeLookupText(entry.labels.ru);
      const en = normalizeLookupText(entry.labels.en);

      return (
        id === normalized ||
        ru === normalized ||
        en === normalized ||
        ru.includes(normalized) ||
        en.includes(normalized)
      );
    }) || null
  );
}

function getCombinedCategoryCatalog() {
  const seen = new Set();

  return [...SCENARIO_ORDER_CATEGORIES, ...SCENARIO_DRAFT_CATEGORIES].filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }

    seen.add(entry.id);
    return true;
  });
}

function toExportLabel(entry, lang = "en") {
  return entry?.labels?.[lang] || entry?.labels?.en || fallbackLabel(lang);
}

export function listScenarioDraftCategories() {
  return [...SCENARIO_DRAFT_CATEGORIES];
}

export function listScenarioOrderCategories() {
  return [...SCENARIO_ORDER_CATEGORIES];
}

export function listScenarioTargetPlatforms() {
  return [...SCENARIO_TARGET_PLATFORMS];
}

export function listScenarioDraftStatuses() {
  return [...SCENARIO_DRAFT_STATUSES];
}

export function getScenarioDraftCategory(input) {
  return findInCatalog(getCombinedCategoryCatalog(), input);
}

export function getScenarioOrderCategory(input) {
  return findInCatalog(SCENARIO_ORDER_CATEGORIES, input);
}

export function getScenarioTargetPlatform(input) {
  return findInCatalog(SCENARIO_TARGET_PLATFORMS, input);
}

export function normalizeScenarioDraftCategory(input, fallback = "other") {
  return getScenarioDraftCategory(input)?.id || fallback;
}

export function normalizeScenarioOrderCategory(input, fallback = "other") {
  return getScenarioOrderCategory(input)?.id || fallback;
}

export function normalizeScenarioTargetPlatform(input, fallback = "other") {
  return getScenarioTargetPlatform(input)?.id || fallback;
}

export function normalizeScenarioDraftStatus(input, fallback = "NEW") {
  const normalized = String(input || "")
    .trim()
    .toUpperCase();

  if (!normalized) {
    return fallback;
  }

  if (normalized === "DRAFT") {
    return "NEW";
  }

  return SCENARIO_DRAFT_STATUSES.includes(normalized) ? normalized : fallback;
}

export function normalizeScenarioConstraints(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 20);
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\r?\n|,/)
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 20);
}

export function buildScenarioDraftTitle(value, fallback = "Scenario request") {
  const normalized = normalizeText(value);

  if (!normalized) {
    return fallback;
  }

  return normalized.length > 120 ? normalized.slice(0, 117).trimEnd() + "..." : normalized;
}

export function getScenarioDraftCategoryLabel(categoryId, lang = "en") {
  const category = getScenarioDraftCategory(categoryId);
  return category?.labels?.[lang] || category?.labels?.en || normalizeText(categoryId) || fallbackLabel(lang);
}

export function getScenarioTargetPlatformLabel(targetPlatform, lang = "en") {
  const platform = getScenarioTargetPlatform(targetPlatform);
  return platform?.labels?.[lang] || platform?.labels?.en || normalizeText(targetPlatform) || fallbackLabel(lang);
}

export function getScenarioDraftSourceLabel(source, lang = "en") {
  const normalized = normalizeLookupText(source);

  if (normalized === "telegram bot") {
    return lang === "ru" ? "Telegram-бот" : "Telegram bot";
  }

  if (normalized === "telegram scenario order") {
    return lang === "ru" ? "Заказ из Telegram Mini App" : "Telegram Mini App order";
  }

  if (normalized === "demo page") {
    return lang === "ru" ? "Демо-страница" : "Demo page";
  }

  if (normalized === "bose telegram") {
    return lang === "ru" ? "BOSE Telegram" : "BOSE Telegram";
  }

  return lang === "ru" ? "Неизвестный источник" : "Unknown source";
}

export function validateScenarioOrderSubmission(payload = {}) {
  const title = normalizeText(payload.title);
  const description = normalizeText(payload.description || payload.rawText);
  const category = normalizeScenarioOrderCategory(payload.category, null);
  const targetPlatform = normalizeScenarioTargetPlatform(payload.targetPlatform, null);
  const constraints = normalizeScenarioConstraints(payload.constraints);
  const errors = [];

  if (!title) {
    errors.push("Title is required.");
  } else if (title.length > 140) {
    errors.push("Title must be 140 characters or fewer.");
  }

  if (!description) {
    errors.push("Description is required.");
  } else if (description.length > 4000) {
    errors.push("Description must be 4000 characters or fewer.");
  }

  if (!category) {
    errors.push("Category is required.");
  }

  if (!targetPlatform) {
    errors.push("Target platform is required.");
  }

  for (const item of constraints) {
    if (item.length > 240) {
      errors.push("Each constraint must be 240 characters or fewer.");
      break;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      title: title || null,
      description: description || null,
      category: category || "other",
      targetPlatform: targetPlatform || "other",
      constraints
    }
  };
}

export function buildScenarioDraftRequestedBy(draft = {}) {
  const username = normalizeText(draft.telegramUsername || draft.username);
  const telegramUserId = normalizeText(draft.telegramUserId);

  if (username && telegramUserId) {
    return `${username.startsWith("@") ? username : `@${username}`} (telegram:${telegramUserId})`;
  }

  if (username) {
    return username.startsWith("@") ? username : `@${username}`;
  }

  if (telegramUserId) {
    return `telegram:${telegramUserId}`;
  }

  return "BOSE Telegram user";
}

export function buildWorkHubScenarioRequestFromDraft(draft = {}) {
  const createdAt = normalizeText(draft.createdAt) || new Date().toISOString();
  const title = buildScenarioDraftTitle(draft.title || draft.aiSummary || draft.rawText, "Scenario request");
  const description = normalizeText(draft.description || draft.rawText) || title;
  const category = toExportLabel(getScenarioOrderCategory(draft.category) || getScenarioDraftCategory(draft.category), "en");
  const targetPlatform = toExportLabel(getScenarioTargetPlatform(draft.targetPlatform), "en");

  return {
    id: `bose-${String(draft.id || cryptoRandomId()).replace(/[^a-zA-Z0-9_-]+/g, "-")}`,
    createdAt,
    title,
    rawDescription: description,
    category,
    targetPlatform,
    constraints: normalizeScenarioConstraints(draft.constraints),
    status: "NEW",
    source: "BOSE_TELEGRAM",
    requestedBy: buildScenarioDraftRequestedBy(draft)
  };
}

function cryptoRandomId() {
  return `scenario-${Math.random().toString(36).slice(2, 10)}`;
}
