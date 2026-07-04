function pushWarning(warnings, message) {
  if (typeof message !== "string" || !message.trim()) {
    return;
  }

  if (!warnings.includes(message)) {
    warnings.push(message);
  }
}

function buildDatabaseMode(databaseReady, databaseHealthy, databaseHasAnyConfig) {
  if (!databaseReady) {
    return databaseHasAnyConfig ? "misconfigured" : "mock";
  }

  return databaseHealthy ? "live" : "degraded";
}

function normalizeDatabaseMessage(database, databaseReady, databaseHasAnyConfig, databaseMissing) {
  if (!databaseReady) {
    if (databaseHasAnyConfig && databaseMissing.length > 0) {
      return `Missing required live database configuration: ${databaseMissing.join(", ")}.`;
    }

    return "Live database configuration is missing. BOSE is running in mock/fallback mode.";
  }

  if (typeof database?.message === "string" && database.message.trim()) {
    return database.message.trim();
  }

  return "Live database health is not ready.";
}

export function evaluateSystemHealth({
  timestamp = new Date().toISOString(),
  env = {},
  database = {},
  telegram = {}
} = {}) {
  const warnings = [];
  const coreMissing = Array.isArray(env.requiredMissing) ? [...env.requiredMissing] : [];
  const databaseReady = Boolean(env?.database?.liveReady);
  const databaseHasAnyConfig =
    Boolean(env?.database?.hasAnyConfig) || Number(env?.database?.configured || 0) > 0;
  const databaseMissing = Array.isArray(env?.database?.requiredMissing)
    ? [...env.database.requiredMissing]
    : [];
  const databaseHealthy = database.ok === true && database.mode === "live";
  const telegramConfigured = Boolean(telegram.configured);
  const appUrlReady = Boolean(telegram.appUrlReady);
  const analyticsEnabled = Boolean(telegram.analyticsEnabled);
  const databaseMessage = normalizeDatabaseMessage(
    database,
    databaseReady,
    databaseHasAnyConfig,
    databaseMissing
  );

  let mode = "live";
  let ok = true;

  if (coreMissing.length > 0) {
    mode = "misconfigured";
    ok = false;
    pushWarning(
      warnings,
      `Missing required core configuration: ${coreMissing.join(", ")}.`
    );
  } else if (!databaseReady) {
    if (databaseHasAnyConfig) {
      mode = "misconfigured";
      ok = false;
      pushWarning(warnings, databaseMessage);
    } else {
      mode = "mock";
      pushWarning(warnings, databaseMessage);
    }
  } else if (!databaseHealthy) {
    mode = "degraded";
    ok = false;
    pushWarning(warnings, databaseMessage);
  } else {
    if (!telegramConfigured) {
      mode = "degraded";
      pushWarning(
        warnings,
        "Telegram bot configuration is missing; launch prerequisites are incomplete."
      );
    }

    if (!appUrlReady) {
      mode = "degraded";
      pushWarning(
        warnings,
        "APP_BASE_URL must be a public https URL before Telegram launch and release checks."
      );
    }

    if (!analyticsEnabled) {
      mode = "degraded";
      pushWarning(
        warnings,
        "Telegram analytics foundation is not fully enabled; launch readiness is incomplete."
      );
    }
  }

  const ready = mode === "live";
  const status = ready ? "ok" : ok ? "warn" : "error";

  return {
    status,
    mode,
    ready,
    ok,
    database: {
      configured: databaseReady,
      ok: databaseHealthy,
      mode: buildDatabaseMode(databaseReady, databaseHealthy, databaseHasAnyConfig),
      message: databaseMessage,
      checkedAt: database.timestamp || null
    },
    telegram: {
      configured: telegramConfigured,
      botReady: Boolean(env?.telegram?.botReady || telegramConfigured),
      appUrlReady,
      analyticsEnabled
    },
    warnings,
    timestamp
  };
}

export function getSystemHealthHttpStatus(health) {
  return health.ready && health.mode === "live" ? 200 : 503;
}

export function createInternalSystemHealth(timestamp = new Date().toISOString()) {
  return {
    status: "error",
    mode: "degraded",
    ready: false,
    ok: false,
    database: {
      configured: false,
      ok: false,
      mode: "degraded",
      message: "System health evaluation failed.",
      checkedAt: null
    },
    telegram: {
      configured: false,
      botReady: false,
      appUrlReady: false,
      analyticsEnabled: false
    },
    warnings: ["System health evaluation failed due to an internal error."],
    timestamp
  };
}
