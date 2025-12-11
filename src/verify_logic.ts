// @ts-nocheck
import { pollChannel, resetSeenMessages } from "./whopMessages";
import { sendBatchToDiscord } from "./discordWebhook";
import { WhopMessage } from "./whopMessages";

// Mock globals
const globalAny: any = global;

// Helper to create mock messages
const createMockMsg = (id: string, content: string): WhopMessage => ({
    id,
    userId: "user1",
    content,
    createdAt: new Date().toISOString(),
    feedId: "feed1",
    feedType: "chat",
    isPosterAdmin: false,
    mentionedUserIds: [],
    fileAttachments: [],
    user: { id: "user1", username: "testuser", name: "Test User" }
});

async function testDeduplication() {
    console.log("Testing Deduplication...");

    // Reset state
    resetSeenMessages();

    // Mock fetch for Whop GraphQL
    globalAny.fetch = async (url: string, options: any) => {
        if (url.includes("whop.com")) {
            // Whop response
            return {
                ok: true,
                json: async () => ({
                    data: {
                        feedPosts: {
                            posts: [
                                createMockMsg("msg1", "First message"),
                                createMockMsg("msg2", "Second message")
                            ],
                            users: [{ id: "user1", username: "testuser", name: "Test User" }] // Need users to map
                        }
                    }
                })
            };
        }
        return { ok: true, text: async () => "" };
    };

    // First poll - should get 2 messages
    // We need a valid channel key from constants. Let's pick ONLINE_SUCCESS.
    // We might need to map the ID used in fetch to what we expect, but here I just return fixed mocked posts regardless of input ID.
    const messages1 = await pollChannel("ONLINE_SUCCESS");
    console.log(`Poll 1: Got ${messages1.length} messages`);
    if (messages1.length !== 2) throw new Error("Expected 2 messages on first poll");

    // Mock fetch receiving one NEW message + 2 OLD
    globalAny.fetch = async (url: string, options: any) => {
        if (url.includes("whop.com")) {
            return {
                ok: true,
                json: async () => ({
                    data: {
                        feedPosts: {
                            posts: [
                                createMockMsg("msg3", "Third message"), // New
                                createMockMsg("msg1", "First message"), // Old
                                createMockMsg("msg2", "Second message") // Old
                            ],
                            users: [{ id: "user1", username: "testuser", name: "Test User" }]
                        }
                    }
                })
            };
        }
        return { ok: true };
    };

    // Second poll - should get 1 message
    const messages2 = await pollChannel("ONLINE_SUCCESS");
    console.log(`Poll 2: Got ${messages2.length} messages`);
    if (messages2.length !== 1) throw new Error("Expected 1 message on second poll");
    if (messages2[0].id !== "msg3") throw new Error("Expected msg3");

    console.log("PASS: Deduplication works\n");
}

async function testRateLimiting() {
    console.log("Testing Discord Rate Limiting...");

    const msgs = [
        createMockMsg("1", "A"),
        createMockMsg("2", "B"),
        createMockMsg("3", "C")
    ];

    let callCount = 0;
    globalAny.fetch = async (url: string) => {
        if (url && url.includes("discord")) {
            callCount++;
            return { ok: true };
        }
        return { ok: true };
    };

    const start = Date.now();
    // Force DISCORD_WEBHOOK_URL to be set so it actually tries to send
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/mock";

    await sendBatchToDiscord(msgs);

    const end = Date.now();
    const duration = end - start;

    console.log(`Sent ${callCount} messages in ${duration}ms`);

    // 3 messages:
    // Send 1 -> wait 500
    // Send 2 -> wait 500
    // Send 3 -> wait 500
    // Total wait = 1500ms
    // allowing some buffer for execution time
    if (duration < 1500) {
        throw new Error(`Too fast! Expected at least 1500ms, got ${duration}ms`);
    }

    console.log("PASS: Rate limiting works");
}

async function run() {
    try {
        await testDeduplication();
        await testRateLimiting();
        console.log("ALL TESTS PASSED");
    } catch (e) {
        console.error("TEST FAILED:", e);
        process.exit(1);
    }
}

run();
