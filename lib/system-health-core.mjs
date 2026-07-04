function pushWarning(warnings, message) {
  if (typeof message !== "string" || !message.trim()) {
    return;
  }

  if (!warnings.includes(message)) {
    warnings.push(message);
  }
}

function normalizeDatabaseMessage(databaseConfigured, database) {
  if (typeof database?.message === "string" && database.message.trim()) {
    return database.message.trim();
  }

  if (!databaseConfigured) {
    return "Live database configuration is missing or incomplete. BOSE is using mock/fallback mode.";
  }

  return "Live database health is not ready.";
}

export function evaluateSystemHealth({
  timestamp = new Date().toISOString(),
  env = {},
  database = {},
  telegram = {},
  analytics = {},
  storage = {},
  ai = {},
  launchMetrics = {}
} = {}) {
  const warnings = [];
  const requiredMissing = Array.isArray(env.requiredMissing) ? [...env.requiredMissing] : [];
  const databaseConfigured = Boolean(env?.database?.liveReady);
  const databaseConfiguredCount = Number(env?.database?.configured || 0);
  const databaseConfiguredTotal = Number(env?.database?.total || 0);
  const databaseHealthy = database.ok === true && database.mode === "live";
  const telegramConfigured = Boolean(telegram.configured);
  const appUrlReady = Boolean(analytics.appUrlReady);
  const analyticsEnabled = Boolean(analytics.enabled);
  const launchMetricsEnabled = Boolean(launchMetrics.enabled);
  const databaseMessage = normalizeDatabaseMessage(databaseConfigured, database);

  let mode = "live";

  if (requiredMissing.length > 0) {
    mode = "misconfigured";
    pushWarning(
      warnings,
      `Missing required core configuration: ${requiredMissing.join(", ")}.`
    );
  } else if (!databaseConfigured) {
    mode = "mock";
    const databaseState =
      databaseConfiguredCount > 0 && databaseConfiguredCount < databaseConfiguredTotal
        ? "incomplete"
        : "missing";
    pushWarning(
      warnings,
      `Live database configuration is ${databaseState}; BOSE is running in mock/fallback mode.`
    );
  } else if (!databaseHealthy) {
    mode = "degraded";
    pushWarning(warnings, databaseMessage);
  }

  if (mode === "live" && !telegramConfigured) {
    mode = "degraded";
    pushWarning(
      warnings,
      "Telegram bot configuration is missing; Telegram launch is not release-ready."
    );
  }

  if (mode === "live" && !appUrlReady) {
    mode = "degraded";
    pushWarning(
      warnings,
      "APP_BASE_URL must be a public https URL before Telegram launch and release checks."
    );
  }

  if (mode === "live" && !analyticsEnabled) {
    mode = "degraded";
    pushWarning(
      warnings,
      "Telegram analytics foundation is not fully enabled; release diagnostics are incomplete."
    );
  }

  const ready = mode === "live";
  const status = ready ? "ok" : mode === "mock" ? "warn" : "error";

  return {
    status,
    mode,
    ready,
    ok: ready,
    timestamp,
    database: {
      configured: databaseConfigured,
      ok: databaseHealthy,
      mode: databaseConfigured ? (databaseHealthy ? "live" : "degraded") : "mock",
      message: databaseMessage,
      checkedAt: database.timestamp || null
    },
    telegram: {
      configured: telegramConfigured,
      botReady: Boolean(env?.telegram?.botReady),
      appUrlReady,
      analyticsEnabled,
      launchMetricsEnabled
    },
    warnings
  };
}
