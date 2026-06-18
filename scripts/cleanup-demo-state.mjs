import { cleanupDemoState } from "../lib/demo-state-cleanup.js";

const argv = process.argv.slice(2);
const applyChanges = argv.includes("--apply");

function readFlagValues(flag) {
  const values = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag && argv[index + 1]) {
      values.push(argv[index + 1]);
      index += 1;
    }
  }

  return values;
}

const keepChatIds = new Set(readFlagValues("--keep-chat").map((value) => String(value).trim()));
const keepOrderNumbers = new Set(
  readFlagValues("--keep-order").map((value) => String(value).trim().toUpperCase())
);
const positionalKeepChats = argv.filter(
  (value) =>
    value &&
    !value.startsWith("--") &&
    /^\d{6,}$/.test(String(value).trim())
);

for (const chatId of positionalKeepChats) {
  keepChatIds.add(String(chatId).trim());
}

const summary = await cleanupDemoState({
  applyChanges,
  keepChatIds: Array.from(keepChatIds),
  keepOrderNumbers: Array.from(keepOrderNumbers)
});

console.log(JSON.stringify(summary, null, 2));
