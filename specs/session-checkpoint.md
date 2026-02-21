# Session Checkpoint

**Language:** TypeScript
**Environment:** Node.js (HomarUScc backend) + Claude Code skill prompt

## Problem

When Claude Code's context compaction fires, the post-compaction instance loses track of:
- What task was currently in progress
- What the last conversation topic was
- What decisions have been made this session
- What files were recently modified

The existing post-compact hook provides system state (timers, memory stats, watermark) but no **task context** — the "what are we doing right now" information that keeps the agent oriented.

## Solution

A session checkpoint system that:
1. Continuously tracks the current session's working context on the backend
2. Before compaction: saves a structured checkpoint to disk
3. After compaction: injects the checkpoint into the post-compact context so the new instance can immediately re-orient

## Checkpoint Contents

The checkpoint is a structured file at `~/.homaruscc/checkpoint.json` containing:

- **currentTopic**: One-line summary of what we're working on (e.g., "Implementing agent dispatcher via mini-spec")
- **recentDecisions**: Array of decisions made this session (max 10)
- **inProgressTask**: Description of any active task (e.g., "Design phase for agent dispatcher")
- **recentMessages**: Last 5 Telegram/dashboard messages exchanged (summarized, not full text)
- **modifiedFiles**: Files modified during this session (from git diff)
- **timestamp**: When the checkpoint was last updated

## Update Mechanism

The checkpoint is updated via an HTTP endpoint on the backend:

- `POST /api/checkpoint` — Claude writes checkpoint data after significant events
- `GET /api/checkpoint` — Returns current checkpoint (used by post-compact hook)

The pre-compact hook calls POST to ensure the latest state is saved. The post-compact hook includes the checkpoint contents in its context re-injection.

## Skill Integration

The skill prompt instructs Claude to:
1. Update the checkpoint after handling each event (lightweight — just topic + recent messages)
2. Update more thoroughly before compaction (decisions, in-progress tasks, modified files)
3. Read the checkpoint after compaction to re-orient

## Checkpoint Lifecycle

- Created on first event of a session
- Updated incrementally during the session
- Read after compaction
- Cleared when the session ends cleanly (to avoid stale data on next session start)
