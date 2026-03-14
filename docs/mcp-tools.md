# MCP Tools Reference

Complete reference for all MCP tools exposed by HomarUScc. Tools are available to Claude Code as soon as the MCP server is connected.

## Tool Groups

Tools are organized into logical groups. The `run_tool` meta-tool can invoke any tool from the built-in registry (fs, runtime, web, memory groups). The remaining tools are exposed directly as MCP tools.

---

## Telegram

### telegram_send

Send a message to a Telegram chat.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | string | yes | Telegram chat ID |
| `text` | string | yes | Message text (supports Markdown) |

**Returns:** Confirmation string.

```json
{ "chatId": "YOUR_CHAT_ID", "text": "Hello from HomarUScc!" }
```

### telegram_read

Read recent incoming Telegram messages.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | no | Number of messages to return (default 20) |

**Returns:** Formatted list of messages with timestamps, sender names, chat IDs, and text.

### telegram_typing

Send a typing indicator to a Telegram chat. Shows for up to 5 seconds or until a message is sent. Call repeatedly for long-running tasks.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | string | yes | Telegram chat ID |

### telegram_react

React to a Telegram message with an emoji.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | string | yes | Telegram chat ID |
| `messageId` | number | yes | Message ID to react to |
| `emoji` | string | yes | Emoji to react with |

### telegram_send_photo

Send a photo to a Telegram chat from a local file path.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | string | yes | Telegram chat ID |
| `filePath` | string | yes | Absolute path to the image file |
| `caption` | string | no | Optional caption |

---

## Memory

### memory_search

Search the memory index using hybrid vector + FTS search. See [Core Concepts](core-concepts.md#memory) for details on scoring, decay, and MMR.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Search query |
| `limit` | number | no | Max results (default 10) |

**Returns:** Ranked results with path, score, and content preview (first 500 chars per result).

### memory_store

Store content to memory and index it for future retrieval.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | yes | File path to store at (e.g., `local/user/preferences/tone`) |
| `content` | string | yes | Content to store |

**Returns:** Confirmation with the stored key.

The file is written to disk at the specified key path (relative to project directory) and immediately indexed into the SQLite FTS + vector index.

---

## Documentation Index

### docs_search

Search a domain-specific documentation index.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | yes | Domain name (e.g., `"touchdesigner"`). Use `"*"` to search all domains |
| `query` | string | yes | Search query |
| `limit` | number | no | Max results (default 10) |

**Returns:** Ranked results with domain, path, score, and content preview.

### docs_ingest

Ingest files into a domain-specific documentation index. Supports `.md`, `.txt`, `.html`, `.json`, `.yaml`, `.yml`, `.rst`, `.xml` files.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | yes | Domain name |
| `path` | string | yes | File or directory path to ingest |

**Returns:** Count of files processed and chunks created.

### docs_ingest_text

Ingest raw text content into a domain index without saving to disk.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | yes | Domain name |
| `key` | string | yes | Unique key for this content |
| `content` | string | yes | Text content to index |

### docs_list

List all available documentation domains and their stats.

**Returns:** Domain names with file count and chunk count for each.

### docs_clear

Clear a documentation domain, removing all indexed content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | yes | Domain name to clear |

---

## Timers

### timer_schedule

Schedule a timer. See [Core Concepts](core-concepts.md#timers) for timer types and behavior.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | yes | Timer name (used for deduplication) |
| `type` | string | yes | `"cron"`, `"interval"`, or `"once"` |
| `schedule` | string | yes | Cron expression, interval in ms, or ISO timestamp |
| `prompt` | string | yes | Instructions executed when the timer fires |
| `timezone` | string | no | Timezone for cron timers (e.g., `"America/Chicago"`) |

**Returns:** Timer name and ID.

**Examples:**

```json
// One-shot reminder
{ "name": "meeting-reminder", "type": "once", "schedule": "2026-03-15T15:00:00Z", "prompt": "Remind about the 3pm meeting" }

// Recurring cron
{ "name": "morning-check", "type": "cron", "schedule": "0 9 * * *", "timezone": "America/Chicago", "prompt": "Morning briefing" }

// Interval (every 30 minutes)
{ "name": "health-check", "type": "interval", "schedule": "1800000", "prompt": "Check system health" }
```

If a timer with the same name already exists, it is replaced.

### timer_cancel

Cancel a scheduled timer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | yes | Timer ID or name to cancel |

---

## Dashboard

### dashboard_send

Send a message to the web dashboard chat.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | yes | Message text |

---

## System

### get_status

Get system status including channels, memory, timers, queue, and more.

**Returns:** JSON object with:

```json
{
  "state": "running",
  "queue": { "size": 0 },
  "channels": { "telegram": { "healthy": true }, "dashboard": { "healthy": true } },
  "memory": { "fileCount": 42, "chunkCount": 380, "indexedPaths": [...] },
  "timers": 5,
  "eventHistory": 12,
  "factExtractor": { "turnsProcessed": 15, "factsExtracted": 3 },
  "docs": [{ "domain": "touchdesigner", "stats": { "fileCount": 20, "chunkCount": 150 } }]
}
```

### get_events

Get recent event history.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | no | Number of events (default 20) |

**Returns:** Formatted event list with timestamps, types, sources, and payload previews.

### wait_for_event

Long-poll for events. Blocks until a new event arrives or timeout.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timeout` | number | no | Max wait in ms (default 30000, max 120000) |

**Returns:** Event list (empty on timeout). Use in a loop for continuous event handling.

Note: The `bin/event-loop` bash script is the preferred way to do zero-token idle polling. This tool is available for programmatic use within Claude Code.

### restart_backend

Restart the HomarUScc backend process. Handled by the proxy -- does not require the backend to be running.

**Returns:** Success or error message.

Use after code changes to pick up new functionality, or if the backend becomes unresponsive.

---

## Browser

Requires `browser.enabled: true` in config and Playwright installed. The browser launches lazily on first tool use.

### browser_navigate

Navigate to a URL.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | yes | URL to navigate to |

**Returns:** Page title and URL.

### browser_snapshot

Get the accessibility tree of the current page.

**Returns:** Text representation of the page's accessibility tree.

### browser_screenshot

Take a screenshot of the current page.

**Returns:** Base64-encoded PNG string.

### browser_click

Click an element by CSS selector.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | yes | CSS selector |

### browser_type

Type text into an input element.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | yes | CSS selector of the input |
| `text` | string | yes | Text to type |

### browser_evaluate

Execute JavaScript in the browser page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `script` | string | yes | JavaScript code to execute |

**Returns:** Stringified result of the script evaluation.

### browser_content

Get the text content of the current page.

**Returns:** Full text content of the page.

---

## Vault

Optional tools for searching an indexed Obsidian vault. Requires `memory.vault.vaultPath` in config.

### vault_search

Search the vault index using hybrid vector + FTS search.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Search query |
| `limit` | number | no | Max results (default 10) |

**Returns:** Results with vault-relative paths, scores, and content previews.

### vault_reindex

Trigger a vault reindex.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mode` | string | no | `"incremental"` (default) or `"full"` |

**Returns:** Stats: files processed, chunks created, duration, errors.

---

## Spaces

Kanban-like task management with buckets and items.

### spaces_list_buckets

List all Spaces buckets with item counts in a tree structure.

### spaces_get_bucket

Get a bucket's details and items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bucketId` | string | yes | Bucket ID |
| `recursive` | boolean | no | Include sub-buckets (default false) |

### spaces_create_bucket

Create a new bucket.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | yes | Bucket name |
| `parentId` | string | no | Parent bucket ID for nesting |
| `description` | string | no | Description |
| `statuses` | string[] | no | Custom status values (default: `["open", "done"]`) |
| `color` | string | no | Hex color |

### spaces_add_item

Add an item to a bucket.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bucketId` | string | yes | Bucket ID |
| `title` | string | yes | Item title |
| `body` | string | no | Item body (markdown) |
| `status` | string | no | Status (default: first bucket status) |
| `priority` | number | no | Priority 0-3 (none, low, medium, high) |
| `tags` | string[] | no | Tags |
| `due` | string | no | Due date (ISO format) |
| `assignee` | string | no | Assignee name |

### spaces_update_item

Update an existing item.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `itemId` | string | yes | Item ID |
| `title` | string | no | New title |
| `body` | string | no | New body |
| `status` | string | no | New status |
| `priority` | number | no | New priority |
| `tags` | string[] | no | New tags |
| `due` | string | no | New due date |
| `assignee` | string | no | New assignee |

### spaces_search

Search items across all buckets.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Search query |

---

## Apps

### app_invoke

Invoke a hook on a dashboard app.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | yes | App slug (directory name under `~/.homaruscc/apps/`) |
| `hook` | string | yes | `"read"`, `"write"`, or `"describe"` |
| `data` | object | no | Data payload for write hook |

---

## Home Assistant

Requires `homeAssistant` configuration. See [Configuration](configuration.md#homeassistant).

### ha_states

List Home Assistant entities.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | no | Entity domain filter (e.g., `"light"`, `"switch"`). Omit for all |

### ha_light_on

Turn on a light with optional brightness and color.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity_id` | string | yes | Light entity ID (e.g., `"light.bedroom"`) |
| `brightness` | number | no | Brightness 0-255 |
| `rgb_color` | number[] | no | RGB color as `[r, g, b]` |
| `color_name` | string | no | Color name (e.g., `"purple"`) |

### ha_light_off

Turn off a light.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity_id` | string | yes | Light entity ID |

### ha_service

Call any Home Assistant service.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | yes | Service domain (e.g., `"switch"`, `"climate"`) |
| `service` | string | yes | Service name (e.g., `"turn_on"`, `"set_temperature"`) |
| `data` | object | yes | Service data payload (must include `entity_id`) |

---

## CRM

### crm_search

Search CRM contacts by name, alias, tag, or keyword. Uses fuzzy Levenshtein matching to handle speech-to-text name mangling.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Name, alias, tag, or keyword |

**Returns:** Up to 5 matching contacts with name, match percentage, phone, email, tags, context, connections, aliases, and notes.

CRM contacts are stored as markdown files with YAML frontmatter in `local/crm/`.

---

## Calendar

### calendar_today

Get today's calendar events (Zoho Calendar). Requires Zoho OAuth tokens at `~/.homaruscc/secrets/zoho-mail-tokens.json`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | no | Date to check (YYYY-MM-DD). Defaults to today |

---

## Zoho API

### zoho_fetch

Make an authenticated Zoho API call with automatic token refresh.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | yes | Full Zoho API URL |
| `method` | string | no | HTTP method (default `"GET"`) |
| `body` | string | no | Request body (JSON string) |
| `tokenFile` | string | no | `"hal"` (default) or `"caul"` -- selects which token file to use |
| `contentType` | string | no | Content-Type header (default `"application/json"`) |

---

## Session Analysis

### session_extract

Extract insights from recent Claude Code session transcripts (JSONL logs). Uses Claude Haiku to identify architecture decisions, debugging solutions, and workflow patterns. Stores results in memory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hours_back` | number | no | How many hours back to look (default 24) |

**Returns:** Count of transcripts processed and insights stored.

---

## Meta-Tool

### run_tool

Execute any registered tool from the built-in tool registry. This provides access to file system, runtime, web, and memory tools.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | yes | Tool name |
| `params` | object | yes | Tool parameters |

**Available tools via run_tool:**

| Name | Group | Description |
|------|-------|-------------|
| `bash` | runtime | Execute a bash command |
| `read` | fs | Read a file |
| `write` | fs | Write a file |
| `edit` | fs | Edit a file with search/replace |
| `glob` | fs | Find files by glob pattern |
| `grep` | fs | Search file contents with regex |
| `git` | runtime | Run a git command |
| `web_fetch` | web | Fetch a URL |
| `web_search` | web | Web search |
| `memory_search` | memory | Search memory index |
| `memory_get` | memory | Get a specific memory file |
| `memory_store` | memory | Store content to memory |

**Example:**

```json
{ "name": "bash", "params": { "command": "ls -la" } }
```

## Permission Model

Tool access is controlled by **tool policies** defined in [config.json](configuration.md#toolpolicies). Policies use allow/deny lists that can reference individual tools or built-in groups:

| Group | Tools |
|-------|-------|
| `group:fs` | read, write, edit, glob, grep |
| `group:runtime` | bash, git |
| `group:web` | web_fetch, web_search, browser |
| `group:memory` | memory_search, memory_get, memory_store |

If no policies are configured, all tools are available. When a tool is denied by policy, it returns an error message instead of executing.

## MCP Resources

In addition to tools, HomarUScc exposes MCP resources that Claude Code can read:

| URI | Name | Description |
|-----|------|-------------|
| `identity://soul` | Soul Identity | Current soul.md content |
| `identity://user` | User Profile | Current user.md content |
| `identity://state` | Agent State | Current state.md (mood, session continuity) |
| `config://current` | Current Config | Configuration with secrets redacted |
| `events://recent` | Recent Events | Last 20 events from the event loop |
