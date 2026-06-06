import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env.local");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Не найден env файл: ${filePath}`);
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

function requireEnv(env, key) {
  if (!env[key]) {
    throw new Error(`Не задана переменная ${key} в ${envPath}`);
  }
}

const env = readEnvFile(envPath);
requireEnv(env, "POSTGRES_HOST");
requireEnv(env, "POSTGRES_DATABASE");
requireEnv(env, "POSTGRES_USER");
requireEnv(env, "POSTGRES_PASSWORD");

const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: Number(env.POSTGRES_PORT || 5432),
  database: env.POSTGRES_DATABASE,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  ssl: env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false
});

async function printTable(title, text, params = []) {
  const result = await pool.query(text, params);
  console.log(`\n${title}`);
  console.table(result.rows);
}

async function main() {
  try {
    await printTable(
      "COUNTS",
      `
        select 'companies' as entity, count(*)::int as total from companies
        union all
        select 'users', count(*)::int from users
        union all
        select 'leads', count(*)::int from leads
        union all
        select 'tasks', count(*)::int from tasks
        union all
        select 'lead_followups', count(*)::int from lead_followups
        union all
        select 'appointments', count(*)::int from appointments
        union all
        select 'lead_events', count(*)::int from lead_events
      `
    );

    await printTable(
      "RECENT_LEADS",
      `
        select
          l.id,
          coalesce(l.full_name, l.telegram_username, 'Клиент без имени') as lead,
          l.source,
          l.channel,
          l.status,
          coalesce(u.full_name, 'Не назначен') as manager,
          l.created_at
        from leads l
        left join users u on u.id = l.assigned_user_id
        order by l.created_at desc
        limit 10
      `
    );

    await printTable(
      "UPCOMING_APPOINTMENTS",
      `
        select
          a.id,
          a.status,
          a.appointment_type,
          a.scheduled_at,
          coalesce(l.full_name, l.telegram_username, 'Клиент без имени') as lead,
          coalesce(u.full_name, 'Не назначен') as owner_name
        from appointments a
        join leads l on l.id = a.lead_id
        left join users u on u.id = a.assigned_user_id
        order by a.scheduled_at asc
        limit 10
      `
    );

    await printTable(
      "PENDING_FOLLOWUPS",
      `
        select
          f.id,
          f.followup_type,
          f.status,
          f.scheduled_at,
          coalesce(l.full_name, l.telegram_username, 'Клиент без имени') as lead,
          coalesce(u.full_name, 'Не назначен') as owner_name
        from lead_followups f
        join leads l on l.id = f.lead_id
        left join users u on u.id = f.assigned_user_id
        where f.status = 'PENDING'
        order by f.scheduled_at asc
        limit 10
      `
    );

    console.log("\nVALIDATION_OK");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`VALIDATION_ERR ${error.message}`);
  process.exitCode = 1;
});
