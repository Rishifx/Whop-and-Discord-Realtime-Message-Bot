import { WHOP_CHANNELS, type ChannelKey } from "./constants";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const STATE_FILE = join(__dirname, ".message-state.json");

const GRAPHQL_URL = "https://api.whop.com/public-graphql";

const FEED_POSTS_QUERY = `query FeedPosts(
  $feedId: ID!
  $feedType: FeedTypes!
  $limit: Int
  $direction: Direction
) {
  feedPosts(
    feedId: $feedId
    feedType: $feedType
    limit: $limit
    direction: $direction
    includeDeleted: false
    includeReactions: false
  ) {
    posts {
      ... on DmsPost {
        id
        userId
        content
        createdAt
        feedId
        feedType
        isPosterAdmin
        mentionedUserIds
        fileAttachments {
          fileUrl
        }
      }
    }
    users {
      id
      username
      name
      profilePic
    }
  }
}`;

export interface FileAttachment {
  fileUrl: string;
}

export interface WhopUser {
  id: string;
  username: string;
  name: string;
  profilePic?: string;
}

export interface WhopMessage {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  feedId: string;
  feedType: string;
  isPosterAdmin: boolean;
  mentionedUserIds: string[];
  fileAttachments: FileAttachment[];
  user?: WhopUser;
}

interface FeedPostsResponse {
  data: {
    feedPosts: {
      posts: Omit<WhopMessage, "user">[];
      users: WhopUser[];
    };
  };
}

let lastSeenMessageIds: Record<string, Set<string>> = {};

function loadState(): void {
  if (existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      for (const [key, ids] of Object.entries(data)) {
        lastSeenMessageIds[key] = new Set(ids as string[]);
      }
      console.log("Loaded state from disk");
    } catch (error) {
      console.error("Failed to load state:", error);
    }
  }
}

function saveState(): void {
  const data: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(lastSeenMessageIds)) {
    data[key] = Array.from(ids);
  }
  writeFileSync(STATE_FILE, JSON.stringify(data), "utf-8");
}

loadState();

type MessageCallback = (channelKey: ChannelKey, messages: WhopMessage[]) => void;
const messageCallbacks: MessageCallback[] = [];

let pollingInterval: ReturnType<typeof setInterval> | null = null;

async function fetchMessages(feedId: string, limit: number = 50): Promise<WhopMessage[]> {
  function buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // Accept multiple env names so users who set different var names still work

    const appKey =
      process.env.WHOP_API_KEY ||
      process.env.WHOP_APP_API_KEY ||
      null;

    // Some setups provide a Company API key instead of an App key.
    // Whop expects "Company <key>" for those keys.
    const companyKeyExplicit =
      process.env.WHOP_COMPANY_API_KEY ||
      process.env.WHOP_COMPANY_KEY ||
      null;

    // Heuristic: company keys often start with "apik_" and contain "_C_".
    // We only treat it as a company key if WHOP_COMPANY_ID is also present
    // or if the user explicitly used WHOP_COMPANY_API_KEY.
    const looksLikeCompanyKey =
      !companyKeyExplicit &&
      appKey &&
      /^apik_/i.test(appKey) &&
      /_C_/i.test(appKey) &&
      !!process.env.WHOP_COMPANY_ID;

    const companyKey = companyKeyExplicit || (looksLikeCompanyKey ? appKey : null);

    if (companyKey) {
      headers["Authorization"] = `Company ${companyKey}`;
      if (!process.env.WHOP_COMPANY_ID) {
        console.warn("WHOP_COMPANY_ID is not set; some company-scoped calls may fail");
      }
    } else if (appKey) {
      headers["Authorization"] = `Bearer ${appKey}`;
    }

    if (process.env.WHOP_COMPANY_ID) {
      headers["x-company-id"] = process.env.WHOP_COMPANY_ID;
    }

    return headers;
  }

  const headers = buildAuthHeaders();

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: FEED_POSTS_QUERY,
      variables: {
        feedId,
        feedType: "chat_feed",
        limit,
        direction: "desc",
      },
    }),
  });

  if (!response.ok) {
    // Try to extract the body for a clearer error message
    let bodyText = "";
    try {
      const clone = await response.clone().text();
      bodyText = clone;
    } catch (e) {
      bodyText = "<unable to read response body>";
    }

    // Provide actionable guidance when the API indicates the wrong key type
    if (response.status === 401 || /App API Key|app api key/i.test(bodyText)) {
      throw new Error(
        `Authentication failed fetching Whop messages (status ${response.status}). The token provided does not appear to be a valid App API Key or app user token.\n` +
        `Make sure you created an *App API Key* in your Whop dashboard (Developer / API Keys or Apps). Then set it as WHOP_API_KEY (or WHOP_APP_API_KEY) in your .env.\n` +
        `Docs / create key: https://whop.com/dashboard/ (check Developer → Company API keys / Apps). Server response: ${bodyText}`
      );
    }

    throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText} - ${bodyText}`);
  }

  const json = await response.json();
  if (!json) {
    throw new Error(`Unexpected empty response from Whop GraphQL`);
  }

  // GraphQL servers often return 200 with an `errors` field — surface those to the user
  if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
    const messages = json.errors.map((e: any) => e.message).join(" \n");

    if (/App API Key|app api key|app's user token|app user token/i.test(messages)) {
      throw new Error(
        `Authentication error from Whop GraphQL: the provided key is not a valid App API Key or app user token.\n` +
        `Create an App API Key in your Whop dashboard (Developer → Apps or Company API keys) and set it as WHOP_API_KEY (or WHOP_APP_API_KEY) in your .env.\n` +
        `Whop response: ${messages}`
      );
    }

    throw new Error(`GraphQL errors from Whop: ${messages}`);
  }

  if (!json.data || !json.data.feedPosts) {
    throw new Error(`Unexpected GraphQL response: ${JSON.stringify(json)}`);
  }

  const { posts, users } = json.data.feedPosts;

  const userMap = new Map(users.map((u: WhopUser) => [u.id, u]));

  return posts.map((post: Omit<WhopMessage, "user">) => ({
    ...post,
    user: userMap.get(post.userId),
  }));
}

async function pollChannel(channelKey: ChannelKey): Promise<WhopMessage[]> {
  const channel = WHOP_CHANNELS[channelKey];

  if (!channel) {
    console.warn(`Channel ${channelKey} not found in configuration`);
    return [];
  }

  if (!lastSeenMessageIds[channel.id]) {
    lastSeenMessageIds[channel.id] = new Set();
  }

  const messages = await fetchMessages(channel.id);
  const seenIds = lastSeenMessageIds[channel.id];

  const newMessages = messages.filter((msg) => !seenIds.has(msg.id));

  for (const msg of messages) {
    seenIds.add(msg.id);
  }

  if (newMessages.length > 0) {
    saveState();
  }

  return newMessages.reverse();
}

async function pollAllChannels(): Promise<void> {
  const channelKeys = Object.keys(WHOP_CHANNELS) as ChannelKey[];

  for (const channelKey of channelKeys) {
    try {
      const messages = await pollChannel(channelKey);

      if (messages.length > 0) {
        for (const callback of messageCallbacks) {
          callback(channelKey, messages);
        }
      }
    } catch (error) {
      console.error(`Error polling ${channelKey}:`, error);
    }
  }
}

export function onNewMessages(callback: MessageCallback): () => void {
  messageCallbacks.push(callback);

  return () => {
    const index = messageCallbacks.indexOf(callback);
    if (index > -1) {
      messageCallbacks.splice(index, 1);
    }
  };
}

export function startPolling(intervalMs: number = 1000): void {
  if (pollingInterval) {
    console.warn("Polling already started");
    return;
  }

  pollAllChannels();

  pollingInterval = setInterval(pollAllChannels, intervalMs);
}

export function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

export function resetSeenMessages(): void {
  for (const key of Object.keys(lastSeenMessageIds)) {
    lastSeenMessageIds[key].clear();
  }
  saveState();
}

export { fetchMessages, pollChannel };
