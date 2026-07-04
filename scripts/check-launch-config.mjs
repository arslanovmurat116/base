import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { getDatabaseConfigState } from "../lib/db.js";
import { getEnvironmentPublicSummary } from "../lib/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const { loadEnvConfig } = nextEnv;

function parseArgs(argv) {
  const options = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--")) {
      continue;
    }

    const [flag, inlineValue] = argument.split("=", 2);
    if (inlineValue !== undefined) {
      options.set(flag, inlineValue);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options.set(flag, next);
      index += 1;
      continue;
    }

    options.set(flag, true);
  }

  return options;
}

function normalizeText(value) {
  const trimmed = String(value || "").trim();

  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function isHttpsUrl(value) {
  return /^https:\/\//i.test(normalizeText(value));
}

function printCreateEnvHint(projectDir) {
  const envExamplePath = path.join(projectDir, ".env.example");
  const envLocalPath = path.join(projectDir, ".env.local");

  if (!fs.existsSync(envExamplePath)) {
    return;
  }

  console.error("Create the local environment file first:");
  console.error(
    `  Copy-Item -LiteralPath "${envExamplePath}" -Destination "${envLocalPath}"`
  );
}

function fail(message, projectDir) {
  console.error(`CONFIG_ERR ${message}`);

  if (projectDir) {
    printCreateEnvHint(projectDir);
  }

  process.exitCode = 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectDir = path.resolve(options.get("--project-dir") || repoRoot);

  loadEnvConfig(projectDir);

  const env = getEnvironmentPublicSummary();
  const databaseState = getDatabaseConfigState();
  const appBaseUrl = normalizeText(process.env.APP_BASE_URL);

  if (!env.ok) {
    fail(`Missing required core variables: ${env.requiredMissing.join(", ")}`, projectDir);
    return;
  }

  if (!isHttpsUrl(appBaseUrl)) {
    fail("APP_BASE_URL must be a public https URL for release checks.", projectDir);
    return;
  }

  if (!databaseState.hasRequiredConfig) {
    fail(
      `Missing live database variables: ${databaseState.requiredMissing.join(", ")}`,
      projectDir
    );
    return;
  }

  if (!normalizeText(process.env.TELEGRAM_BOT_TOKEN)) {
    fail("Missing Telegram variables: TELEGRAM_BOT_TOKEN", projectDir);
    return;
  }

  console.log("CONFIG_OK Release configuration is present.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Unknown configuration error");
});
