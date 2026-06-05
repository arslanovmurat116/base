import {
  fetchTelegramUpdates,
  forwardUpdateToLocalWebhook,
  loadTelegramConfig,
  readUpdateOffset,
  writeUpdateOffset
} from "./telegram-common.mjs";

async function main() {
  const config = loadTelegramConfig();

  if (!config.token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const currentOffset = readUpdateOffset();
  const updates = await fetchTelegramUpdates(config.token, currentOffset);

  if (!updates.length) {
    console.log("No updates");
    return;
  }

  let latestOffset = currentOffset;

  for (const update of updates) {
    await forwardUpdateToLocalWebhook(config.baseUrl, config.secret, update);
    latestOffset = Math.max(latestOffset, Number(update.update_id || 0) + 1);
  }

  writeUpdateOffset(latestOffset);
  console.log(`Processed updates: ${updates.length}`);
  console.log(`Next offset: ${latestOffset}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
