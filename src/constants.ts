const TEST_ID = process.env.WHOP_CHANNEL_ID;

export const WHOP_CHANNELS = {
  // If WHOP_CHANNEL_ID is set in .env, use it for valid testing
  ...(TEST_ID ? { TEST_CHANNEL: { id: TEST_ID, name: "Test Channel" } } : {}),

  // Legacy / Example channels (will fail if you don't have access)
  // ONLINE_SUCCESS: { id: "chat_feed_1CTxMpdZRE5H2bXvqG4i2W", name: "Online Success" },
  // INSTORE_SUCCESS: { id: "chat_feed_1CTxMpgtZ8CZ9HeHZTTa2f", name: "Instore Success" },
  // PROFITS: { id: "chat_feed_1CTxMpky4RFkNvgvghBjpN", name: "Profits" },
  // TESTIMONIALS: { id: "chat_feed_1CTxMpYPmZGLqjborFDcCn", name: "Testimonials" },
} as const;

export type ChannelKey = keyof typeof WHOP_CHANNELS;
