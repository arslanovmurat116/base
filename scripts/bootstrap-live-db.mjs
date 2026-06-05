import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(appDir, "..");
const envPath = path.join(appDir, ".env.local");

function readEnvFile(filePath) {
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

const env = readEnvFile(envPath);
const sqlFiles = [
  "001_lead_control_schema.sql",
  "002_lead_control_ops.sql",
  "003_telegram_support.sql",
  "004_system_config.sql",
  "005_sales_ops.sql",
  "100_seed_local.sql",
  "110_seed_demo_pipeline.sql"
].map((name) => path.join(rootDir, "database", name));

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
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`BOOTSTRAP_ERR ${error.message}`);
  process.exitCode = 1;
});
