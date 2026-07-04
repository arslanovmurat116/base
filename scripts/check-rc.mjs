import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = new Map();
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--")) {
      positionals.push(argument);
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

  if (!options.has("--base-url") && positionals.length > 0) {
    options.set("--base-url", positionals[0]);
  }

  return options;
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return value.trim().replace(/\/+$/, "");
}

function getNpmCommand() {
  return "npm";
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function printRuntimeInstruction(baseUrl) {
  const runtimeBaseUrl = baseUrl || "http://127.0.0.1:3100";

  console.error("RC_RUNTIME_REQUIRED Start the freshly built runtime and rerun the runtime gate.");
  console.error(`  cd "${repoRoot}"`);
  console.error("  npm run start -- --hostname 127.0.0.1 --port 3100");
  console.error(`  npm run check:rc:runtime -- --base-url ${runtimeBaseUrl}`);
  console.error(`  npm run check:rc -- --base-url ${runtimeBaseUrl}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runtimeBaseUrl = normalizeBaseUrl(
    options.get("--base-url") || process.env.BOSE_RC_RUNTIME_URL
  );
  const npmCommand = getNpmCommand();

  const staticExitCode = await runCommand(npmCommand, ["run", "check:rc:static"]);
  if (staticExitCode !== 0) {
    process.exitCode = staticExitCode;
    return;
  }

  if (!runtimeBaseUrl) {
    printRuntimeInstruction(runtimeBaseUrl);
    process.exitCode = 1;
    return;
  }

  const runtimeExitCode = await runCommand(npmCommand, [
    "run",
    "check:rc:runtime",
    "--",
    "--base-url",
    runtimeBaseUrl
  ]);

  process.exitCode = runtimeExitCode;
}

main().catch((error) => {
  console.error(`RC_ERR ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
});
