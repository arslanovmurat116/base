import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env.local");
const databaseDir = path.join(repoRoot, "database");
const cliArgs = new Set(process.argv.slice(2));

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

function resolveSqlFiles() {
  const schemaFiles = [
    "001_lead_control_schema.sql",
    "002_lead_control_ops.sql",
    "003_telegram_support.sql",
    "004_system_config.sql",
    "005_sales_ops.sql",
    "006_appointments.sql",
    "007_appointment_followthrough.sql",
    "008_telegram_qualification.sql",
    "009_performance_indexes.sql",
    "010_telegram_runtime_state.sql",
    "011_product_runtime_state.sql",
    "012_lead_runtime_patches.sql",
    "013_telegram_control_runtime.sql",
    "014_telegram_update_offsets.sql",
    "015_bose_core_foundation.sql",
    "016_bose_dual_write_backfill.sql",
    "017_bose_rc1_indexes.sql",
    "018_telegram_launch_foundation.sql",
    "019_bose_bot_scenarios.sql"
  ];

  const withLocalSeed =
    cliArgs.has("--with-local-seed") ||
    cliArgs.has("--with-demo") ||
    process.env.LIVE_DB_WITH_LOCAL_SEED === "true";
  const withDemoSeed =
    cliArgs.has("--with-demo") || process.env.LIVE_DB_WITH_DEMO === "true";

  const selected = [...schemaFiles];

  if (withLocalSeed) {
    selected.push("100_seed_local.sql");
  }

  if (withDemoSeed) {
    selected.push("110_seed_demo_pipeline.sql");
  }

  return selected.map((name) => path.join(databaseDir, name));
}

const env = readEnvFile(envPath);
requireEnv(env, "POSTGRES_HOST");
requireEnv(env, "POSTGRES_DATABASE");
requireEnv(env, "POSTGRES_USER");
requireEnv(env, "POSTGRES_PASSWORD");

const sqlFiles = resolveSqlFiles();

for (const filePath of sqlFiles) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Не найден SQL файл: ${filePath}`);
  }
}

const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: Number(env.POSTGRES_PORT || 5432),
  database: env.POSTGRES_DATABASE,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  ssl: env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    for (const filePath of sqlFiles) {
      const sql = fs.readFileSync(filePath, "utf8");
      await pool.query(sql);
      console.log(`APPLIED ${path.basename(filePath)}`);
    }

    console.log("BOOTSTRAP_OK");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`BOOTSTRAP_ERR ${error.message}`);
  process.exitCode = 1;
});
