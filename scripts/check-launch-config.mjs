import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const DEFAULT_ENV_EXAMPLE = path.join(repoRoot, ".env.example");
const DEFAULT_ENV_LOCAL = path.join(repoRoot, ".env.local");

const REQUIRED_CORE_KEYS = ["DISET_DEFAULT_COMPANY_ID", "APP_BASE_URL"];
const REQUIRED_DATABASE_KEYS = [
  "POSTGRES_HOST",
  "POSTGRES_DATABASE",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD"
];
const REQUIRED_TELEGRAM_KEYS = ["TELEGRAM_BOT_TOKEN"];

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

function readEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index === -1) {
          return [line, ""];
        }

        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );
}

function collectMissing(env, keys) {
  return keys.filter((key) => !env[key]);
}

function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\//i.test(value.trim());
}

function printCreateEnvHint(envExamplePath, envLocalPath) {
  console.error("Create the local environment file first:");
  console.error(
    `  Copy-Item -LiteralPath "${envExamplePath}" -Destination "${envLocalPath}"`
  );
}

function fail(message) {
  console.error(`CONFIG_ERR ${message}`);
  process.exitCode = 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envExamplePath = path.resolve(
    options.get("--env-example") || DEFAULT_ENV_EXAMPLE
  );
  const envLocalPath = path.resolve(options.get("--env-local") || DEFAULT_ENV_LOCAL);

  if (!fs.existsSync(envExamplePath)) {
    fail(`Missing environment template: ${envExamplePath}`);
    return;
  }

  if (!fs.existsSync(envLocalPath)) {
    fail(`Missing local environment file: ${envLocalPath}`);
    printCreateEnvHint(envExamplePath, envLocalPath);
    return;
  }

  const env = readEnvFile(envLocalPath);
  const missingCore = collectMissing(env, REQUIRED_CORE_KEYS);
  const missingDatabase = collectMissing(env, REQUIRED_DATABASE_KEYS);
  const missingTelegram = collectMissing(env, REQUIRED_TELEGRAM_KEYS);

  if (missingCore.length > 0) {
    fail(`Missing required core variables: ${missingCore.join(", ")}`);
    return;
  }

  if (!isHttpsUrl(env.APP_BASE_URL)) {
    fail("APP_BASE_URL must be a public https URL for release checks.");
    return;
  }

  if (missingDatabase.length > 0) {
    fail(`Missing live database variables: ${missingDatabase.join(", ")}`);
    return;
  }

  if (missingTelegram.length > 0) {
    fail(`Missing Telegram variables: ${missingTelegram.join(", ")}`);
    return;
  }

  console.log("CONFIG_OK Release configuration is present.");
  console.log(`CONFIG_ENV ${path.basename(envLocalPath)}`);
}

main().catch((error) => {
  fail(error.message);
});
