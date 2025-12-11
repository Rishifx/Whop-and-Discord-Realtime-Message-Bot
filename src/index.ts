import "dotenv/config";
import { startPolling, stopPolling, onNewMessages } from "./whopMessages";
import { sendBatchToDiscord } from "./discordWebhook";

const POLL_INTERVAL_MS = 3000;

export function startForwarding(intervalMs: number = POLL_INTERVAL_MS): () => void {

  const unsubscribe = onNewMessages(async (channelKey, messages) => {

    try {
      await sendBatchToDiscord(messages);
    } catch (error) {
      console.error(`[${channelKey}] Failed to forward:`, error);
    }
  });

  startPolling(intervalMs);

  return () => {
    stopPolling();
    unsubscribe();
  };
}

if (require.main === module) {
  const cleanup = startForwarding();

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
}
