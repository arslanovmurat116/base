import {
  fetchTelegramUpdates,
  forwardUpdateToLocalWebhook,
  loadTelegramConfig,
  readUpdateOffset,
  writeUpdateOffset
} from "./telegram-common.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const config = loadTelegramConfig();

  if (!config.token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  console.log(`Telegram loop started -> ${config.baseUrl}/api/telegram/webhook`);

  let currentOffset = readUpdateOffset();

  while (true) {
    const updates = await fetchTelegramUpdates(config.token, currentOffset, 15);

    if (!updates.length) {
      continue;
    }

    for (const update of updates) {
      await forwardUpdateToLocalWebhook(config.baseUrl, config.secret, update);
      currentOffset = Math.max(currentOffset, Number(update.update_id || 0) + 1);
    }

    writeUpdateOffset(currentOffset);
    console.log(`Processed updates: ${updates.length}. Next offset: ${currentOffset}`);
    await sleep(250);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
