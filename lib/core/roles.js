const CORE_ROLE_DEFINITIONS = Object.freeze({
  owner: {
    code: "owner",
    telegramRole: "director",
    labels: {
      en: "Owner",
      ru: "Собственник"
    },
    aliases: ["owner", "director", "собственник", "директор"],
    scope: "company",
    surfaces: ["web", "telegram"]
  },
  manager: {
    code: "manager",
    telegramRole: "manager",
    labels: {
      en: "Manager",
      ru: "Менеджер"
    },
    aliases: ["manager", "менеджер"],
    scope: "company",
    surfaces: ["web", "telegram"]
  },
  operator: {
    code: "operator",
    telegramRole: "measurer",
    labels: {
      en: "Operator",
      ru: "Оператор"
    },
    aliases: ["operator", "measurer", "замерщик", "оператор"],
    scope: "company",
    surfaces: ["web", "telegram"]
  },
  client: {
    code: "client",
    telegramRole: "client",
    labels: {
      en: "Client",
      ru: "Клиент"
    },
    aliases: ["client", "customer", "клиент"],
    scope: "external",
    surfaces: ["telegram", "miniapp"]
  }
});

const TELEGRAM_SURFACE_ROLES = Object.freeze({
  director: {
    code: "director",
    coreRole: "owner",
    labels: {
      en: "Director",
      ru: "Директор"
    },
    aliases: ["director", "owner", "директор", "собственник"]
  },
  manager: {
    code: "manager",
    coreRole: "manager",
    labels: {
      en: "Manager",
      ru: "Менеджер"
    },
    aliases: ["manager", "менеджер"]
  },
  measurer: {
    code: "measurer",
    coreRole: "operator",
    labels: {
      en: "Measurer",
      ru: "Замерщик"
    },
    aliases: ["measurer", "operator", "замерщик", "оператор"]
  },
  client: {
    code: "client",
    coreRole: "client",
    labels: {
      en: "Client",
      ru: "Клиент"
    },
    aliases: ["client", "customer", "клиент"]
  }
});

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, " ")
    .trim();
}

export function listCoreRoleDefinitions() {
  return Object.values(CORE_ROLE_DEFINITIONS);
}

export function getCoreRoleDefinition(role) {
  return CORE_ROLE_DEFINITIONS[normalizeCoreRole(role, null)] || null;
}

export function normalizeCoreRole(role, fallback = "owner") {
  const normalized = normalizeLookupText(role);

  for (const definition of Object.values(CORE_ROLE_DEFINITIONS)) {
    if (definition.aliases.includes(normalized)) {
      return definition.code;
    }
  }

  return fallback;
}

export function normalizeTelegramSurfaceRole(role) {
  const normalized = normalizeLookupText(role);

  for (const definition of Object.values(TELEGRAM_SURFACE_ROLES)) {
    if (definition.aliases.includes(normalized)) {
      return definition.code;
    }
  }

  return null;
}

export function mapTelegramRoleToCoreRole(role, fallback = "manager") {
  const normalized = normalizeTelegramSurfaceRole(role);
  return normalized ? TELEGRAM_SURFACE_ROLES[normalized].coreRole : fallback;
}

export function mapCoreRoleToTelegramRole(role, fallback = "manager") {
  const normalized = normalizeCoreRole(role, null);
  return normalized ? CORE_ROLE_DEFINITIONS[normalized].telegramRole : fallback;
}

export function getCoreRoleLabel(role, locale = "ru") {
  const definition = getCoreRoleDefinition(role);

  if (!definition) {
    return locale === "en" ? "Unknown role" : "Неизвестная роль";
  }

  return definition.labels[locale] || definition.labels.ru;
}

export function getTelegramRoleLabel(role, locale = "ru") {
  const normalized = normalizeTelegramSurfaceRole(role);
  const definition = normalized ? TELEGRAM_SURFACE_ROLES[normalized] : null;

  if (!definition) {
    return locale === "en" ? "Unassigned" : "Не назначена";
  }

  return definition.labels[locale] || definition.labels.ru;
}

export function canAccessOwnerScope(role) {
  return normalizeCoreRole(role, "owner") === "owner";
}

export function describeUnifiedRole(role) {
  const coreRole = normalizeCoreRole(role, null);
  const telegramRole =
    normalizeTelegramSurfaceRole(role) || mapCoreRoleToTelegramRole(coreRole, null);
  const definition = coreRole ? CORE_ROLE_DEFINITIONS[coreRole] : null;

  if (!definition) {
    return null;
  }

  return {
    coreRole,
    telegramRole,
    labels: definition.labels,
    scope: definition.scope,
    surfaces: definition.surfaces
  };
}

