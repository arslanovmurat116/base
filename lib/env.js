import { getDatabaseConfigState } from "./db.js";

const ENV_GROUPS = Object.freeze({
  core: [
    { key: "DISET_DEFAULT_COMPANY_ID", required: true },
    { key: "APP_BASE_URL", required: true }
  ],
  database: [
    { key: "POSTGRES_HOST", required: false },
    { key: "POSTGRES_PORT", required: false },
    { key: "POSTGRES_DATABASE", required: false },
    { key: "POSTGRES_USER", required: false },
    { key: "POSTGRES_PASSWORD", required: false },
    { key: "POSTGRES_SSL", required: false }
  ],
  telegram: [
    { key: "TELEGRAM_BOT_TOKEN", required: false },
    { key: "TELEGRAM_BOT_SECRET_TOKEN", required: false },
    { key: "CRON_SECRET", required: false }
  ],
  storage: [{ key: "BLOB_READ_WRITE_TOKEN", required: false }],
  ai: [
    { key: "OPENAI_API_KEY", required: false },
    { key: "OPENAI_MODEL", required: false }
  ]
});

function resolveValue(key) {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalConfigured(groupEntries) {
  const configured = groupEntries.filter((entry) => resolveValue(entry.key)).length;
  return {
    total: groupEntries.length,
    configured
  };
}

export function getEnvironmentDiagnostics() {
  const databaseState = getDatabaseConfigState();
  const coreEntries = ENV_GROUPS.core.map((entry) => ({
    ...entry,
    configured: Boolean(resolveValue(entry.key))
  }));
  const databaseEntries = ENV_GROUPS.database.map((entry) => ({
    ...entry,
    configured: Boolean(resolveValue(entry.key))
  }));
  const telegramEntries = ENV_GROUPS.telegram.map((entry) => ({
    ...entry,
    configured: Boolean(resolveValue(entry.key))
  }));
  const storageEntries = ENV_GROUPS.storage.map((entry) => ({
    ...entry,
    configured: Boolean(resolveValue(entry.key))
  }));
  const aiEntries = ENV_GROUPS.ai.map((entry) => ({
    ...entry,
    configured: Boolean(resolveValue(entry.key))
  }));

  const requiredMissing = coreEntries
    .filter((entry) => entry.required && !entry.configured)
    .map((entry) => entry.key);
  const telegramConfigured = telegramEntries[0]?.configured || false;
  const aiConfigured = aiEntries[0]?.configured || false;

  return {
    ok: requiredMissing.length === 0,
    requiredMissing,
    groups: {
      core: {
        entries: coreEntries,
        configured: coreEntries.filter((entry) => entry.configured).length,
        total: coreEntries.length
      },
      database: {
        entries: databaseEntries,
        ...normalizeOptionalConfigured(databaseEntries),
        liveReady: databaseState.hasRequiredConfig,
        hasAnyConfig: databaseState.hasAnyConfig,
        requiredMissing: databaseState.requiredMissing
      },
      telegram: {
        entries: telegramEntries,
        ...normalizeOptionalConfigured(telegramEntries),
        botReady: telegramConfigured
      },
      storage: {
        entries: storageEntries,
        ...normalizeOptionalConfigured(storageEntries)
      },
      ai: {
        entries: aiEntries,
        ...normalizeOptionalConfigured(aiEntries),
        aiReady: aiConfigured
      }
    }
  };
}

export function getEnvironmentPublicSummary() {
  const diagnostics = getEnvironmentDiagnostics();

  return {
    ok: diagnostics.ok,
    requiredMissing: diagnostics.requiredMissing,
    core: {
      total: diagnostics.groups.core.total,
      configured: diagnostics.groups.core.configured
    },
    database: {
      liveReady: diagnostics.groups.database.liveReady,
      hasAnyConfig: diagnostics.groups.database.hasAnyConfig,
      requiredMissing: diagnostics.groups.database.requiredMissing,
      configured: diagnostics.groups.database.configured,
      total: diagnostics.groups.database.total
    },
    telegram: {
      botReady: diagnostics.groups.telegram.botReady,
      configured: diagnostics.groups.telegram.configured,
      total: diagnostics.groups.telegram.total
    },
    storage: {
      configured: diagnostics.groups.storage.configured,
      total: diagnostics.groups.storage.total
    },
    ai: {
      aiReady: diagnostics.groups.ai.aiReady,
      configured: diagnostics.groups.ai.configured,
      total: diagnostics.groups.ai.total
    }
  };
}
