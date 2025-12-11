import type { WhopMessage } from "./whopMessages";

interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
}

export async function sendToDiscord(
  message: WhopMessage
): Promise<void> {
  const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
  if (!DISCORD_WEBHOOK_URL) {
    // Only warn once per session ideally, or just return silently if handled elsewhere
    return;
  }

  const username = message.user?.name || message.user?.username || "Unknown";
  const avatarUrl = message.user?.profilePic;

  const imageUrls = (message.fileAttachments || []).map((a) => a.fileUrl).filter(Boolean);

  // Include text content and images
  const parts: string[] = [];
  if (message.content && message.content.trim()) parts.push(message.content.trim());
  if (imageUrls.length) parts.push(...imageUrls);

  const content = parts.join("\n\n");

  if (!content) return;

  const payload: DiscordWebhookPayload = {
    content,
    username,
    avatar_url: avatarUrl,
  };

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} - ${error}`);
  }
}

export async function sendBatchToDiscord(
  messages: WhopMessage[]
): Promise<void> {
  for (const message of messages) {
    await sendToDiscord(message);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
