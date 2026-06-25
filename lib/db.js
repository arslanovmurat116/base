import { Pool } from "pg";

function hasDatabaseConfig() {
  return Boolean(
    process.env.POSTGRES_HOST &&
      process.env.POSTGRES_DATABASE &&
      process.env.POSTGRES_USER &&
      process.env.POSTGRES_PASSWORD
  );
}

const globalForPg = globalThis;

function getPoolSignature() {
  return JSON.stringify({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    sslEnabled: process.env.POSTGRES_SSL === "true"
  });
}

function createPool() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl:
      process.env.POSTGRES_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECT_TIMEOUT_MS || 15000),
    keepAlive: true,
    allowExitOnIdle: true,
    maxUses: Number(process.env.POSTGRES_POOL_MAX_USES || 750),
    application_name: "bose-rc1"
  });

  pool.on("error", (error) => {
    console.warn("Postgres pool error:", error.message);
  });

  return pool;
}

function getQueryTimeouts() {
  return {
    statement_timeout: Number(process.env.POSTGRES_STATEMENT_TIMEOUT_MS || 20000),
    query_timeout: Number(process.env.POSTGRES_QUERY_TIMEOUT_MS || 25000)
  };
}

function buildQueryConfig(text, params = []) {
  if (typeof text === "object" && text?.text) {
    return {
      ...text,
      ...getQueryTimeouts()
    };
  }

  return {
    text,
    values: params,
    ...getQueryTimeouts()
  };
}

function isTransientDatabaseError(error) {
  const message = String(error?.message || "").toLowerCase();

  return [
    "connection terminated unexpectedly",
    "connection terminated due to connection timeout",
    "timeout exceeded when trying to connect",
    "connection timeout",
    "econnreset"
  ].some((fragment) => message.includes(fragment));
}

async function resetPool() {
  const existingPool = globalForPg.__disetPgPool;
  globalForPg.__disetPgPool = null;
  globalForPg.__disetPgPoolSignature = null;

  if (!existingPool) {
    return;
  }

  try {
    await existingPool.end();
  } catch {
    // Ignore pool shutdown errors during retry.
  }
}

export function isLiveDatabaseEnabled() {
  return hasDatabaseConfig();
}

export function getDatabaseConfigState() {
  return {
    hasHost: Boolean(process.env.POSTGRES_HOST),
    hasDatabase: Boolean(process.env.POSTGRES_DATABASE),
    hasUser: Boolean(process.env.POSTGRES_USER),
    hasPassword: Boolean(process.env.POSTGRES_PASSWORD),
    sslEnabled: process.env.POSTGRES_SSL === "true"
  };
}

export function getPool() {
  if (!hasDatabaseConfig()) {
    return null;
  }

  const signature = getPoolSignature();

  if (!globalForPg.__disetPgPool || globalForPg.__disetPgPoolSignature !== signature) {
    globalForPg.__disetPgPool = createPool();
    globalForPg.__disetPgPoolSignature = signature;
  }

  return globalForPg.__disetPgPool;
}

export async function query(text, params = []) {
  const currentPool = getPool();

  if (!currentPool) {
    throw new Error("Live database is not configured");
  }

  const config = buildQueryConfig(text, params);

  try {
    return await currentPool.query(config);
  } catch (error) {
    if (!isTransientDatabaseError(error)) {
      throw error;
    }

    console.warn("Retrying Postgres query after transient error:", error.message);
    await resetPool();
    const retryPool = getPool();

    if (!retryPool) {
      throw error;
    }

    return retryPool.query(config);
  }
}

export async function checkDatabaseHealth() {
  if (!hasDatabaseConfig()) {
    return {
      ok: false,
      mode: "mock",
      message: "Missing environment variables for the live database"
    };
  }

  try {
    const result = await query("select now() as now");

    return {
      ok: true,
      mode: "live",
      message: "Database connection is healthy",
      timestamp: result.rows[0]?.now ?? null
    };
  } catch (error) {
    return {
      ok: false,
      mode: "mock",
      message: `Database health check failed: ${error.message}`
    };
  }
}
