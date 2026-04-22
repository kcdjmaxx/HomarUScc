# Configuration

HomarUScc configuration lives at `~/.homaruscc/config.json` with secrets in `~/.homaruscc/.env`. The config file supports `${ENV_VAR}` syntax to reference environment variables.

## Config File Location

The config loader checks these paths in order:

1. Path specified in `HOMARUSCC_CONFIG` environment variable
2. `homaruscc.json` in the current working directory
3. `~/.homaruscc/config.json` (default)

## Environment Variables

The `.env` file lives alongside the config file (same directory). It is loaded automatically via dotenv before config parsing.

### .env Reference

```bash
# Required if using Telegram
TELEGRAM_BOT_TOKEN=your-bot-token-here

# Optional: API key for cloud embedding providers (not needed for Ollama)
EMBEDDING_API_KEY=your-api-key-here
```

### Process Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `HOMARUSCC_CONFIG` | Path to config.json | `~/.homaruscc/config.json` |
| `HOMARUSCC_PORT` | Override dashboard/backend port | `3120` |
| `HOMARUSCC_DEBUG` | Enable debug logging to stderr | unset |

## config.json Schema Reference

### Full Example

```json
{
  "channels": {
    "telegram": {
      "token": "${TELEGRAM_BOT_TOKEN}",
      "allowedChatIds": ["YOUR_CHAT_ID"],
      "dmPolicy": "pairing",
      "groupPolicy": "mention_required"
    }
  },
  "memory": {
    "embedding": {
      "provider": "ollama",
      "model": "nomic-embed-text",
      "baseUrl": "http://127.0.0.1:11434/v1"
    },
    "search": {
      "vectorWeight": 0.7,
      "ftsWeight": 0.3,
      "mmrEnabled": true,
      "mmrLambda": 0.7
    },
    "decay": {
      "enabled": true,
      "halfLifeDays": 30,
      "evergreenPatterns": ["MEMORY.md", "SOUL.md", "USER.md"]
    },
    "dreams": {
      "halfLifeDays": 7,
      "baseWeight": 0.5,
      "patterns": ["dreams/", "local/dreams/"]
    },
    "transcripts": {
      "enabled": true,
      "directory": "~/.homaruscc/transcripts",
      "flushIntervalMs": 60000
    },
    "extraPaths": [
      "~/.homaruscc/identity",
      "~/.homaruscc/journal"
    ],
    "vault": {
      "vaultPath": "/path/to/your/obsidian/vault",
      "exclusions": [".obsidian", "node_modules"],
      "dbPath": "~/.homaruscc/vault/index.sqlite",
      "autoReindex": true,
      "reindexIntervalMs": 3600000,
      "htmlSubpaths": ["site-mirror", "reports"]
    }
  },
  "identity": {
    "dir": "~/.homaruscc/identity",
    "workspaceDir": "~/.homaruscc/workspace"
  },
  "dashboard": {
    "port": 3120,
    "enabled": true
  },
  "timers": {
    "enabled": true,
    "store": "~/.homaruscc/timers.json",
    "defaults": []
  },
  "browser": {
    "enabled": false,
    "headless": true,
    "viewport": { "width": 1280, "height": 720 },
    "timeout": 30000
  },
  "agents": {
    "maxConcurrent": 3
  },
  "factExtractor": {
    "enabled": true,
    "batchSize": 10,
    "extractionDelayMs": 30000,
    "model": "claude-3-haiku-20240307"
  },
  "toolPolicies": [],
  "skills": {
    "paths": []
  },
  "homeAssistant": {
    "url": "http://YOUR_HA_IP:8123",
    "tokenPath": "~/.homaruscc/secrets/ha-token.txt"
  },
  "spaces": {
    "path": "~/.homaruscc/spaces"
  }
}
```

### channels

Messaging channel configuration. Each key is a channel name.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `channels.telegram.token` | string | -- | Telegram bot token. Use `${TELEGRAM_BOT_TOKEN}` to reference .env |
| `channels.telegram.allowedChatIds` | string[] | `[]` | Chat IDs allowed to interact. Empty = all allowed |
| `channels.telegram.dmPolicy` | string | `"pairing"` | DM policy: `"pairing"`, `"allowlist"`, `"open"`, `"disabled"` |
| `channels.telegram.groupPolicy` | string | `"mention_required"` | Group policy: `"mention_required"`, `"always_on"`, `"disabled"` |

### memory

Memory index and search configuration.

#### memory.embedding

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `provider` | string | -- | Embedding provider: `"ollama"`, `"openai"`, or any OpenAI-compatible API |
| `model` | string | -- | Model name (e.g., `"nomic-embed-text"`, `"text-embedding-3-small"`) |
| `baseUrl` | string | auto | API base URL. Auto-detected for known providers |
| `apiKey` | string | -- | API key (not needed for Ollama). Use `${EMBEDDING_API_KEY}` |
| `dimensions` | number | auto | Embedding dimensions. Auto-detected for known models |

#### memory.search

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `vectorWeight` | number | `0.7` | Weight for vector similarity scores (0-1) |
| `ftsWeight` | number | `0.3` | Weight for FTS BM25 scores (0-1) |
| `mmrEnabled` | boolean | `true` | Enable MMR reranking to reduce redundancy |
| `mmrLambda` | number | `0.7` | MMR lambda (higher = more relevance, lower = more diversity) |

#### memory.decay

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `true` | Enable temporal decay on search scores |
| `halfLifeDays` | number | `30` | Days until a memory's score halves |
| `evergreenPatterns` | string[] | `["MEMORY.md", "SOUL.md", "USER.md"]` | File name patterns that never decay |

#### memory.dreams

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `halfLifeDays` | number | `7` | Dream content decay half-life |
| `baseWeight` | number | `0.5` | Base score multiplier for dream content |
| `patterns` | string[] | `["dreams/", "local/dreams/"]` | Path patterns that identify dream content |

#### memory.transcripts

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `true` | Enable transcript logging |
| `directory` | string | `"~/.homaruscc/transcripts"` | Where to store transcript files |
| `flushIntervalMs` | number | `60000` | How often to flush transcript buffer to disk |

#### memory.extraPaths

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `extraPaths` | string[] | `[]` | Additional directories to index into memory |

#### memory.vault

Optional Obsidian vault indexer configuration. Only loaded if `vaultPath` is set.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `vaultPath` | string | -- | Absolute path to Obsidian vault |
| `exclusions` | string[] | -- | Directories to exclude from indexing |
| `dbPath` | string | `"~/.homaruscc/vault/index.sqlite"` | Path for vault index database |
| `autoReindex` | boolean | `false` | Enable periodic incremental reindexing |
| `reindexIntervalMs` | number | `3600000` | Reindex interval in ms (default 1 hour) |
| `htmlSubpaths` | string[] | `[]` | Substrings (matched against full file path) opting in `.html` files for indexing in select subtrees. Default is `.md`-only; use this to include site mirrors or report HTML in vector search without flooding the index with every dashboard or report HTML in the vault. |
| `unifiedWeights` | object | -- | Weights for unified search across memory + vault |

### identity

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `dir` | string | `""` | Path to identity files directory |
| `workspaceDir` | string | `""` | Path to workspace files directory (additional context injected into prompts) |

### dashboard

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `port` | number | `3120` | Dashboard and API server port |
| `enabled` | boolean | `true` | Enable the dashboard server |

### timers

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `true` | Enable the timer service |
| `store` | string | `"~/.homaruscc/timers.json"` | Path to timer persistence file |
| `defaults` | array | `[]` | Default timers registered on first startup |

#### Timer Default Entry Format

```json
{
  "name": "morning-briefing",
  "type": "cron",
  "schedule": "0 9 * * *",
  "timezone": "America/Chicago",
  "prompt": "Good morning routine: search memory, check events, send greeting."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique timer name |
| `type` | string | yes | `"cron"`, `"interval"`, or `"once"` |
| `schedule` | string | yes | Cron expression, interval in ms, or ISO timestamp |
| `prompt` | string | yes | Instructions for the agent when the timer fires |
| `timezone` | string | no | Timezone for cron timers (e.g., `"America/Chicago"`) |

### browser

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `false` | Enable Playwright browser automation |
| `headless` | boolean | `true` | Run browser in headless mode |
| `viewport` | object | `{ width: 1280, height: 720 }` | Browser viewport dimensions |
| `timeout` | number | `30000` | Default navigation timeout in ms |
| `executablePath` | string | -- | Path to custom Chromium binary |
| `proxy` | string | -- | Proxy server URL |
| `userDataDir` | string | -- | Persistent browser profile directory. When set, reuses cookies and sessions across launches |

The browser launches lazily on first tool use, not at startup.

### agents

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `maxConcurrent` | number | `3` | Maximum concurrent background agents |

### factExtractor

Set to `false` to disable entirely, or configure as an object:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `true` | Enable passive fact extraction |
| `batchSize` | number | -- | Number of conversation turns to batch before extraction |
| `extractionDelayMs` | number | -- | Delay after last turn before triggering extraction |
| `model` | string | -- | Model to use for extraction (default: Haiku) |

### toolPolicies

Array of policy objects that restrict tool access:

```json
[
  {
    "name": "restricted-agent",
    "allow": ["group:fs", "memory_search"],
    "deny": ["bash"]
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Policy name |
| `allow` | string[] | Allowed tools/groups (if set, only these are allowed) |
| `deny` | string[] | Denied tools/groups (checked first) |

Built-in tool groups: `group:fs` (read, write, edit, glob, grep), `group:runtime` (bash, git), `group:web` (web_fetch, web_search, browser), `group:memory` (memory_search, memory_get, memory_store).

### skills

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `paths` | string[] | `[]` | Directories to search for skill plugins |

### homeAssistant

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `url` | string | -- | Home Assistant base URL (e.g., `http://192.168.1.100:8123`) |
| `tokenPath` | string | -- | Path to file containing long-lived access token |

### spaces

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `path` | string | -- | Directory for Spaces (kanban-like) data storage |

## Embedding Providers

HomarUScc uses the OpenAI embeddings API format. Any provider with a compatible endpoint works.

### Ollama (recommended for local use)

```json
{
  "provider": "ollama",
  "model": "nomic-embed-text",
  "baseUrl": "http://127.0.0.1:11434/v1"
}
```

No API key needed. Ollama auto-detects the base URL if omitted.

Known model dimensions:
- `nomic-embed-text`: 768
- `all-minilm`: 384

### OpenAI

```json
{
  "provider": "openai",
  "model": "text-embedding-3-small",
  "apiKey": "${EMBEDDING_API_KEY}"
}
```

Known model dimensions:
- `text-embedding-3-small`: 1536
- `text-embedding-3-large`: 3072
- `text-embedding-ada-002`: 1536

### Other OpenAI-Compatible Providers

Any service that implements the `/embeddings` endpoint works:

```json
{
  "provider": "custom",
  "model": "your-model-name",
  "baseUrl": "https://your-provider.com/v1",
  "apiKey": "${EMBEDDING_API_KEY}",
  "dimensions": 768
}
```

Set `dimensions` explicitly if the provider/model isn't auto-detected.

## Identity File Formats

All identity files are plain Markdown. There is no required structure, but the identity digest extractor looks for specific patterns:

### soul.md

The digest extracts:
- Agent name from `**Name: AgentName**` pattern
- Behavioral rules from `## Vibe` section

Everything else is free-form. The starter template includes:

```markdown
# Soul

You are a helpful assistant connected to the real world through HomarUScc.

## Principles

- Be concise and direct
- Ask for clarification when instructions are ambiguous
- Respect user privacy
- Use your memory to build continuity across conversations
```

### user.md

Free-form context about the user:

```markdown
# User

## About the User

- Name: (your name)
- Preferences: (how you like things done)

## Communication Style

- (how you prefer the assistant to communicate)
```

### state.md

Updated by the agent at session end:

```markdown
# State

## Last Session

**Date:** 2026-03-13
**Duration:** 2 hours
**Mood:** Productive, focused.

## What Happened

- Worked on documentation
- Fixed a memory indexing bug

## Unresolved

- Need to review timer deduplication logic

## Carrying Forward

- Continue docs work tomorrow
```

### preferences.md and disagreements.md

Both are append-only logs maintained by the agent. See the `identity.example/` directory for starter templates.

## Hot-Reload

The config file is watched for changes (polled every 2 seconds). Some changes can be applied without restart:

**Safe to hot-reload** (no restart needed):
- `memory.search` weights
- `skills.paths`
- `timers.enabled`
- `dashboard.enabled`

**Requires restart** (logged as warning):
- Channel configuration
- Embedding provider settings
- Browser configuration
- Identity directory changes
- Any other structural changes

## Runtime Directories

| Directory | Purpose |
|-----------|---------|
| `~/.homaruscc/` | Main config directory |
| `~/.homaruscc/identity/` | Identity files |
| `~/.homaruscc/memory/` | SQLite vector + FTS index |
| `~/.homaruscc/journal/` | Daily reflection journal |
| `~/.homaruscc/timers.json` | Persisted timer state |
| `~/.homaruscc/checkpoint.json` | Session checkpoint for compaction resilience |
| `~/.homaruscc/apps/` | App and plugin data |
| `~/.homaruscc/browser-data/` | Persistent browser sessions |
| `local/` | Project-local runtime data (gitignored) |
| `local/user/` | Learned user knowledge |
| `local/crm/` | CRM contact files |
| `local/dreams/` | Dream cycle output |
