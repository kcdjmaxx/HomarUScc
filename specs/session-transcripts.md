# Session Transcript Indexing

## Overview

Index conversation turns (inbound messages and outbound responses) so the agent can search its own past conversations. Answers "what did we discuss last week?" queries that explicit memory_store calls don't cover.

## Data Sources

Two types of conversation turns to capture:

1. **Inbound messages** — already arrive as events with type "message" from Telegram and dashboard channels. Contains: sender, channel, text, timestamp.
2. **Outbound responses** — sent via `telegram_send` and `dashboard_send` tool calls. Contains: channel, text, timestamp.

Both sides flow through the backend, so capture happens entirely in the backend process.

## Capture Strategy

Add a TranscriptLogger that:
- Listens for inbound message events on the EventBus
- Hooks into outbound send tool calls (telegram_send, dashboard_send) to capture responses
- Accumulates turns in a session buffer with timestamps and direction (inbound/outbound)
- Periodically flushes the buffer to a dated transcript file and indexes it

## Storage

Transcripts are stored as markdown files under a configurable directory (default: `~/.homaruscc/transcripts/`):

```
~/.homaruscc/transcripts/
  2026-02-20.md
  2026-02-21.md
```

Each file is a daily log:
```markdown
# Transcript: 2026-02-20

## 14:32:05 [telegram:in] Max
checking inventory status

## 14:32:08 [telegram:out]
Current inventory looks good. Beer stock is at 80%, ...

## 15:10:22 [dashboard:in] Max
what did we discuss about the roadmap?
```

## Indexing

When a transcript file is flushed, it gets indexed by the existing MemoryIndex (indexFile). This means transcript content becomes searchable via the same hybrid vector+FTS search, with temporal decay naturally deprioritizing old conversations.

## Flush Triggers

- **Periodic**: every N minutes (configurable, default 5 minutes) if buffer is non-empty
- **Session end**: flush remaining buffer on shutdown
- **Pre-compaction**: the CompactionManager should trigger a transcript flush as part of its pre-compact routine

## Configuration

```json
{
  "memory": {
    "transcripts": {
      "enabled": true,
      "directory": "~/.homaruscc/transcripts",
      "flushIntervalMs": 300000
    }
  }
}
```

## Privacy

Transcript files contain raw conversation content. They are stored locally only (no cloud sync by default). The config directory should already be gitignored. Users can disable transcript indexing via config.

## Edge Cases

- If the transcript directory doesn't exist, create it on first flush
- If a flush fails (disk full, permission error), log the error and retain the buffer for retry
- Empty buffers don't trigger flushes
- Multiple sessions on the same day append to the same file
