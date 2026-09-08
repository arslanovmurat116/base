import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import nextEnv from "@next/env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env.local");
const { loadEnvConfig } = nextEnv;

function requireEnv(key) {
  const value = String(process.env[key] || "").trim();

  if (!value) {
    throw new Error(`Не задана переменная ${key} в process.env или ${envPath}`);
  }

  return value;
}

loadEnvConfig(repoRoot);
const host = requireEnv("POSTGRES_HOST");
const databaseName = requireEnv("POSTGRES_DATABASE");
const user = requireEnv("POSTGRES_USER");
const password = requireEnv("POSTGRES_PASSWORD");

const pool = new Pool({
  host,
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: databaseName,
  user,
  password,
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false
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
        union all
        select 'telegram_bot_requests', count(*)::int from telegram_bot_requests
        union all
        select 'telegram_retention_campaigns', count(*)::int from telegram_retention_campaigns
        union all
        select 'scenario_drafts', count(*)::int from scenario_drafts
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
      "RETENTION_LIFECYCLE",
      `
        select
          count(*) filter (where coalesce(bot_launch_count, 0) + coalesce(miniapp_launch_count, 0) <= 1 and last_seen_at >= now() - interval '1 day')::int as new_users,
          count(*) filter (where coalesce(bot_launch_count, 0) + coalesce(miniapp_launch_count, 0) >= 2 and active_days_count < 3 and last_seen_at >= now() - interval '7 days')::int as activated_users,
          count(*) filter (where active_days_count >= 3 and last_seen_at >= now() - interval '7 days')::int as engaged_users,
          count(*) filter (where last_seen_at < now() - interval '7 days' and last_seen_at >= now() - interval '30 days')::int as dormant_users,
          count(*) filter (where last_seen_at < now() - interval '30 days')::int as inactive_users
        from telegram_identities
      `
    );

    await printTable(
      "RECENT_SCENARIO_DRAFTS",
      `
        select
          id,
          source,
          category,
          left(coalesce(ai_summary, raw_text), 120) as summary,
          status,
          created_at
        from scenario_drafts
        order by updated_at desc, created_at desc
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

    await printTable("PROJECT_FILE_VERSIONS", `select count(*)::int as versions,
      count(*) filter (where is_current)::int as current_files,
      count(*) filter (where not is_current)::int as archived_files from project_file_versions`);
    const invalidCurrent = await pool.query(`select company_id, lead_id, group_key from project_file_versions
      group by company_id, lead_id, group_key having count(*) filter (where is_current) <> 1`);
    if (invalidCurrent.rowCount) throw new Error("Project file families must have exactly one current version");
    await printTable("STAFF_PROJECT_REQUESTS", "select count(*)::int as requests from telegram_client_leads where source_ref is not null");
    console.log("\nVALIDATION_OK");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`VALIDATION_ERR ${error.message}`);
  process.exitCode = 1;
});
