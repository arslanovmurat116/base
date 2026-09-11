import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const members = [
  { telegramId: "7723975336", role: "owner", name: "Мурат" },
  { telegramId: "5503846479", role: "owner", name: "Андрей" },
  { telegramId: "6429658489", role: "installer", name: "Алексей" },
  { telegramId: "8746239854", role: "installer", name: "Антон" },
  { telegramId: "661098765", role: "installer", name: "Тимур" },
  { telegramId: "850637064", role: "designer", name: "Катя" }
];

const apply = process.argv.includes("--apply");
const cfg = parseEnv(fs.readFileSync(path.join(root, ".env.local"), "utf8"));
const companyId = cfg.DISET_DEFAULT_COMPANY_ID;

if (!companyId) throw new Error("Company is not configured");

const client = new Client({
  host: cfg.POSTGRES_HOST,
  port: Number(cfg.POSTGRES_PORT || 5432),
  database: cfg.POSTGRES_DATABASE,
  user: cfg.POSTGRES_USER,
  password: cfg.POSTGRES_PASSWORD,
  ssl: cfg.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10_000,
  query_timeout: 20_000,
  application_name: "bose-rbac-security-cutover"
});

function telegramRole(role) {
  return role === "owner" ? "director" : role === "operator" ? "measurer" : role;
}

try {
  await client.connect();
  await client.query("begin");
  await client.query("set local lock_timeout = '5s'");
  await client.query("set local statement_timeout = '15s'");

  for (const file of ["024_production_team.sql", "025_authoritative_auth.sql"]) {
    await client.query(fs.readFileSync(path.join(root, "database", file), "utf8"));
  }

  const beforeUsers = (await client.query(
    "select id, full_name, role, is_active, telegram_user_id from users where company_id = $1 for update",
    [companyId]
  )).rows;
  const beforeSubscriptions = (await client.query(
    "select chat_id, role, full_name, telegram_user_id, source from telegram_subscribers where company_id = $1",
    [companyId]
  )).rows;

  for (const member of members) {
    const existing = beforeUsers.find((row) => row.telegram_user_id === member.telegramId) ||
      (member.name === "Мурат" ? beforeUsers.find((row) => row.role === "owner" && row.full_name === "Мурат") : null);

    if (existing) {
      await client.query(
        "update users set telegram_user_id = $3, role = $4, full_name = $5, is_active = true, auth_version = auth_version + 1 where company_id = $1 and id = $2",
        [companyId, existing.id, member.telegramId, member.role, member.name]
      );
    } else {
      await client.query(
        "insert into users (company_id, telegram_user_id, full_name, role, is_active, auth_version) values ($1, $2, $3, $4, true, 1)",
        [companyId, member.telegramId, member.name, member.role]
      );
    }

    await client.query(
      "update telegram_subscribers set source = 'legacy-non-authoritative' where company_id = $1 and telegram_user_id = $2",
      [companyId, member.telegramId]
    );
    await client.query(
      `insert into telegram_subscribers (company_id, chat_id, role, full_name, telegram_user_id, source, registered_at, last_seen_at)
       values ($1, $2, $3, $4, $2, 'owner-assigned', now(), now())
       on conflict (company_id, chat_id, role) do update
       set full_name = excluded.full_name, telegram_user_id = excluded.telegram_user_id, source = 'owner-assigned', last_seen_at = now()`,
      [companyId, member.telegramId, telegramRole(member.role), member.name]
    );
  }

  const revoked = await client.query(
    "update miniapp_sessions set session_status = 'ENDED', ended_at = coalesce(ended_at, now()) where company_id = $1 and session_status = 'ACTIVE'",
    [companyId]
  );
  await client.query(
    "insert into security_audit_events (company_id, event_name, details) values ($1, 'security_v2_cutover', $2::jsonb)",
    [companyId, JSON.stringify({ beforeUsers, beforeSubscriptions, confirmedMembers: members })]
  );

  const after = (await client.query(
    "select full_name, role, is_active, telegram_user_id from users where company_id = $1 and telegram_user_id is not null order by full_name",
    [companyId]
  )).rows;
  const owners = after.filter((row) => row.role === "owner" && row.is_active).map((row) => row.telegram_user_id).sort();
  const expectedOwners = members.filter((member) => member.role === "owner").map((member) => member.telegramId).sort();
  if (JSON.stringify(owners) !== JSON.stringify(expectedOwners)) throw new Error("Unexpected owner roster");

  await client.query(apply ? "commit" : "rollback");
  console.log(JSON.stringify({
    mode: apply ? "APPLIED" : "DRY_RUN_ROLLED_BACK",
    users: after.map(({ telegram_user_id, ...row }) => ({ ...row, telegramIdSuffix: telegram_user_id.slice(-4) })),
    sessionsRevoked: revoked.rowCount
  }));
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(JSON.stringify({ code: error.code || null, message: error.code ? "Database operation failed; transaction rolled back" : error.message }));
  process.exitCode = 1;
} finally {
  await client.end();
}
