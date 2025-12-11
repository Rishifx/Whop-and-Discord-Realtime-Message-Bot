import "dotenv/config";
import { whopsdk } from "./whopSdk";
import { fetchMessages } from "./whopMessages";

async function verifyToken() {
    const key = process.env.WHOP_API_KEY;
    const channelId = process.env.WHOP_CHANNEL_ID;

    console.log("Checking token:", key ? `${key.substring(0, 10)}...` : "NONE");
    console.log("Target Channel:", channelId || "NONE (will skip feed check)");

    if (!key) {
        console.error("No WHOP_API_KEY found in .env");
        return;
    }

    try {
        // Skipping user check as SDK types are unclear. 
        // const user = await whopsdk.me(); 
        console.log("Token detected (verification skipped, proceeding to feed check)");

        if (channelId) {
            console.log(`Attempting to fetch messages from ${channelId}...`);
            try {
                const messages = await fetchMessages(channelId, 1);
                console.log(`Success! Found ${messages.length} messages.`);
                console.log("Access is configured correctly.");
            } catch (feedError: any) {
                console.error(`Access Denied to Channel ${channelId}:`);
                console.error(feedError.message || feedError);
                console.log("\nPossible reasons:");
                console.log("1. The Chat ID is incorrect.");
                console.log("2. Your App is not installed in the Company that owns this Chat.");
                console.log("3. Your App does not have 'Messages' read permissions.");
            }
        } else {
            console.log("\nAdd WHOP_CHANNEL_ID to .env to test specific channel access.");
        }

    } catch (error: any) {
        console.error("Token verification failed:");
        console.error(error.message || error);
    }
}

verifyToken();
