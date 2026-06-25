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
        union all
        select 'telegram_subscribers', count(*)::int from telegram_subscribers
        union all
        select 'telegram_client_leads', count(*)::int from telegram_client_leads
        union all
        select 'product_pilot_requests', count(*)::int from product_pilot_requests
        union all
        select 'product_launch_handoffs', count(*)::int from product_launch_handoffs
        union all
        select 'customer_success_loops', count(*)::int from customer_success_loops
        union all
        select 'lead_runtime_patches', count(*)::int from lead_runtime_patches
        union all
        select 'telegram_registration_states', count(*)::int from telegram_registration_states
        union all
        select 'telegram_dispatch_logs', count(*)::int from telegram_dispatch_logs
        union all
        select 'telegram_update_offsets', count(*)::int from telegram_update_offsets
        union all
        select 'roles', count(*)::int from roles
        union all
        select 'user_roles', count(*)::int from user_roles
        union all
        select 'clients', count(*)::int from clients
        union all
        select 'deals', count(*)::int from deals
        union all
        select 'business_events', count(*)::int from business_events
        union all
        select 'miniapp_sessions', count(*)::int from miniapp_sessions
        union all
        select 'telegram_identities', count(*)::int from telegram_identities
        union all
        select 'telegram_analytics_events', count(*)::int from telegram_analytics_events
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

    await printTable(
      "LEADS_WITHOUT_DEAL",
      `
        select
          l.id,
          coalesce(l.full_name, l.telegram_username, 'Клиент без имени') as lead,
          l.status,
          l.created_at
        from leads l
        left join deals d
          on d.company_id = l.company_id
         and d.lead_id = l.id
        where d.id is null
        order by l.created_at desc
        limit 20
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
