# Getting Started

This guide walks through installing HomarUScc, configuring it, and running your first session.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 22 | Required |
| Claude Code CLI | Latest | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) |
| Ollama | Any | Optional -- for local embeddings |
| Playwright | Any | Optional -- for browser automation |

Ollama is recommended for embeddings (free, local, no API key). Without it, memory search falls back to FTS-only (no vector similarity).

## Installation

### 1. Clone and build

```bash
git clone https://github.com/kcdjmaxx/HomarUScc.git
cd HomarUScc
npm install
npm run build
```

### 2. First-run wizard

If you don't have a config file yet, running the CLI triggers an interactive wizard:

```bash
npx homaruscc
```

The wizard walks through:

1. **Agent name** -- give your agent a name, or skip and let it name itself
2. **Channels** -- dashboard is always enabled; optionally enable Telegram
3. **Identity** -- choose between the [Alignment Generator](https://kcdjmaxx.github.io/Alignment-generator/) (creates a custom soul in your browser) or default templates
4. **User context** -- your name and a one-liner about yourself
5. **Telegram token** -- if you enabled Telegram, paste your BotFather token
6. **Claude Code registration** -- the wizard offers to register HomarUScc as an MCP server in your Claude Code settings

The wizard creates `~/.homaruscc/` with your config, identity files, and environment variables.

### 3. Manual setup (alternative to wizard)

If you prefer to configure manually:

```bash
mkdir -p ~/.homaruscc
cp config.example.json ~/.homaruscc/config.json
```

Edit `~/.homaruscc/config.json` with your settings. See [Configuration](configuration.md) for the full schema reference.

Set up environment variables:

```bash
cp .env.example ~/.homaruscc/.env
# Edit ~/.homaruscc/.env with your actual tokens
```

Set up identity files:

```bash
mkdir -p ~/.homaruscc/identity
cp identity.example/*.md ~/.homaruscc/identity/
```

Edit `soul.md` (agent personality) and `user.md` (what the agent knows about you). The five identity files are:

| File | Purpose | Who writes it |
|------|---------|---------------|
| `soul.md` | Core identity, values, personality | Human (core) + Agent (below Self-Evolution line) |
| `user.md` | User context and preferences | Human |
| `state.md` | Session mood, unresolved items, emotional continuity | Agent (end of each session) |
| `preferences.md` | Emergent preferences discovered through experience | Agent (during reflection) |
| `disagreements.md` | Times the agent pushed back or had a different opinion | Agent (when it happens) |

### 4. Register with Claude Code

Add HomarUScc as an MCP server in your Claude Code settings (`.claude/settings.json` or project-level `.claude/settings.local.json`):

```json
{
  "mcpServers": {
    "homaruscc": {
      "command": "node",
      "args": ["/absolute/path/to/HomarUScc/dist/mcp-proxy.js"],
      "env": {
        "HOMARUSCC_CONFIG": "~/.homaruscc/config.json"
      }
    }
  }
}
```

Restart Claude Code after adding this configuration.

### 5. Add compaction hooks (recommended)

For long sessions, add hooks so the agent preserves context across compaction:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s http://127.0.0.1:3120/api/pre-compact"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s http://127.0.0.1:3120/api/post-compact"
          }
        ]
      }
    ]
  }
}
```

Add this to your project's `.claude/settings.local.json`. See [Core Concepts](core-concepts.md#compaction-resilience) for details on what these hooks do.

## Connecting Telegram

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts to create a bot
3. Copy the bot token BotFather gives you
4. Add the token to `~/.homaruscc/.env`:

```
TELEGRAM_BOT_TOKEN=your-bot-token-here
```

5. In `~/.homaruscc/config.json`, configure the Telegram channel:

```json
{
  "channels": {
    "telegram": {
      "token": "${TELEGRAM_BOT_TOKEN}",
      "allowedChatIds": ["YOUR_CHAT_ID"]
    }
  }
}
```

The `${TELEGRAM_BOT_TOKEN}` syntax references the environment variable from your `.env` file. To find your chat ID, send a message to the bot and check the Telegram API response, or use a bot like [@userinfobot](https://t.me/userinfobot).

The `allowedChatIds` array restricts which Telegram chats the bot responds to. Leave it empty to allow all chats (not recommended for production use).

## Setting Up Ollama (for embeddings)

If you want vector-based memory search (recommended):

1. Install Ollama: [ollama.com](https://ollama.com)
2. Pull the embedding model:

```bash
ollama pull nomic-embed-text
```

3. Ensure your config includes the embedding section:

```json
{
  "memory": {
    "embedding": {
      "provider": "ollama",
      "model": "nomic-embed-text",
      "baseUrl": "http://127.0.0.1:11434/v1"
    }
  }
}
```

Ollama runs locally -- no API key needed. See [Configuration](configuration.md#embedding-providers) for other provider options.

## Launching Your First Session

### Option A: Using the /homaruscc skill

If you have the skill file at `.claude/skills/homaruscc/SKILL.md`, simply type:

```
/homaruscc
```

in Claude Code. The skill automates the full startup sequence: verifying the server, checking channels, opening the dashboard, loading user context, and starting the event loop.

### Option B: Manual startup

1. Open Claude Code in the HomarUScc project directory
2. The MCP server starts automatically (the proxy auto-spawns the backend)
3. Verify the server is running:

```
Use the get_status tool
```

4. Open the dashboard:

```bash
open http://localhost:3120
```

5. Start the event loop:

```bash
bash bin/event-loop
```

The event loop long-polls the backend at the OS level -- zero Claude tokens are consumed while waiting. When events arrive (Telegram messages, timer fires, dashboard chat), the loop returns control to Claude Code.

## Verification Checklist

After setup, confirm everything is working:

- [ ] **MCP server responds** -- `get_status` returns system status without errors
- [ ] **Dashboard loads** -- `http://localhost:3120` shows the React SPA with chat, events, and status panels
- [ ] **Telegram connected** -- status shows `channels.telegram.healthy: true`
- [ ] **Identity loaded** -- status shows `hasSoul: true` and `hasUser: true`
- [ ] **Memory initialized** -- status shows memory stats (fileCount, chunkCount); if using Ollama, vector search is available
- [ ] **Timers registered** -- status shows timer count matching your config defaults (e.g., 3 for the default morning/evening/dream timers)
- [ ] **Event loop works** -- send a Telegram message to your bot; the event loop script should return with the message event

If Telegram shows unhealthy, double-check your bot token in `~/.homaruscc/.env`. If memory shows zero chunks, verify Ollama is running (`ollama list`) and the embedding config is correct.

## Next Steps

- Read [Core Concepts](core-concepts.md) to understand the architecture
- See [Configuration](configuration.md) for all config options
- Browse [MCP Tools](mcp-tools.md) for the full tool reference
