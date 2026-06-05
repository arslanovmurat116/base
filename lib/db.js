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
  return new Pool({
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
    connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECT_TIMEOUT_MS || 10000),
    keepAlive: true,
    allowExitOnIdle: true,
    application_name: "mebel-rdn-crm"
  });
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

  if (
    !globalForPg.__disetPgPool ||
    globalForPg.__disetPgPoolSignature !== signature
  ) {
    globalForPg.__disetPgPool = createPool();
    globalForPg.__disetPgPoolSignature = signature;
  }

  return globalForPg.__disetPgPool;
}

export async function query(text, params = []) {
  const currentPool = getPool();

  if (!currentPool) {
    throw new Error("Живая база не настроена");
  }

  return currentPool.query(text, params);
}

export async function checkDatabaseHealth() {
  if (!hasDatabaseConfig()) {
    return {
      ok: false,
      mode: "mock",
      message: "Не хватает переменных окружения для живой базы"
    };
  }

  try {
    const result = await query("select now() as now");

    return {
      ok: true,
      mode: "live",
      message: "Подключение к базе активно",
      timestamp: result.rows[0]?.now ?? null
    };
  } catch (error) {
    return {
      ok: false,
      mode: "mock",
      message: `Ошибка подключения к базе: ${error.message}`
    };
  }
}
