<div align="center">

# 🚀 Whop to Discord Bridge

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=nodedotjs)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success)

**A high-performance, resilient bot that bridges Whop Chats with Discord Webhooks in real-time.** 

[View Demo Video](public/Demo.mp4) • [Report Bug](https://github.com/issues) • [Request Feature](https://github.com/issues)

</div>

---

## 📖 Overview

The **Whop-Discord Bridge** is designed to seamlessly forward messages from your Whop community to a configured Discord channel. It solves common integration challenges like duplicate messages, rate limiting, and media handling out of the box.

### ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **⚡ Real-Time Polling** | Monitors Whop chats with a customizable 3-second heartbeat. |
| **🛡️ Smart Deduplication** | Uses persistent state (`.message-state.json`) to guarantee 0% message duplication. |
| **🖼️ Rich Media Support** | Automatically detects and renders images in Discord embeds. |
| **🚦 Rate Limit Control** | Intelligent `500ms` throttling queue to respect Discord API limits. |
| **🔐 Secure Config** | Enterprise-grade configuration using `.env` variables. |

---

## 📸 Proof of Concept

> **Source:** Whop Chat
> The bot captures every user interaction, including text repeats and images.

![Whop Chat](assets/screenshots/whop_proof.png)

> **Destination:** Discord Channel
> Messages arrive instantly, reflecting the exact state of the source.

![Discord Webhook](assets/screenshots/discord_proof.png)

---

## 🛠️ Installation & Setup

### 1. Prerequisites
*   **Node.js** (v16 or higher)
*   **NPM** or **Yarn**

### 2. Clone & Install
```bash
git clone https://github.com/Rishifx/Whop-and-Discord-Realtime-Message-Bot.git
cd Whop-and-Discord-Realtime-Message-Bot
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:

```env
# 🔑 Whop Configuration
WHOP_API_KEY=apik_your_app_key_here
WHOP_CHANNEL_ID=chat_feed_your_feed_id_here

# 🔗 Discord Configuration
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_url
```

> **Tip:** You can find the `WHOP_CHANNEL_ID` by inspecting the Network tab in your browser while viewing the chat (look for `chat_feed_...`).

### 4. Run the Bot
```bash
# Development Mode
npm run dev

# Production Mode
npm start
```

---

## 🧩 Architecture

The system consists of three core modules:

*   **`whopMessages.ts`**: Handles authentication and fetches generic messages from the Whop GraphQL API.
*   **`discordWebhook.ts`**: Manages the webhook payload construction and enforces the 500ms delay.
*   **`index.ts`**: Orchestrates the polling loop and manages the lifecycle/graceful shutdowns.

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
