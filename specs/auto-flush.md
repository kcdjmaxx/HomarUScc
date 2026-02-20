# Auto-Flush Before Compaction

**Language:** TypeScript
**Environment:** Node.js >= 22, Claude Code hooks system

When Claude Code's context window approaches its limit, the system automatically compacts (summarizes) the conversation to free space. Any information not explicitly stored to memory is lost during compaction. Auto-flush prevents this silent data loss.

## Hook-Based Detection

Claude Code provides a PreCompact hook that fires before compaction begins. HomarUScc registers a hook that calls the backend's HTTP API to trigger a memory flush. A post-compaction hook (SessionStart with compact matcher) re-injects critical context after compaction completes.

## Pre-Compact Flush

When the PreCompact hook fires:

- The backend receives an HTTP request at a dedicated endpoint
- It generates a flush prompt: a structured summary of what should be persisted
- The hook's stdout is injected into the context before compaction, prompting the agent to save important session state
- The flush includes: recent conversation topics, decisions made, task progress, any unsaved observations

## Post-Compact Re-injection

When the SessionStart hook fires with compact matcher after compaction:

- The backend receives an HTTP request at a dedicated endpoint
- It returns critical context that should be re-injected verbatim into the fresh post-compaction context
- This includes: active timer names, current task context, identity reminders, recent memory keys
- This content survives verbatim (not summarized) because it enters the fresh context

## Setup Integration

The hooks must be registered in the user's Claude Code settings. HomarUScc should:

- Provide the hook configuration as part of setup instructions
- Expose the necessary API endpoints on the dashboard server (port 3120)
- Log pre-compact and post-compact events to the event history

## Flush State Tracking

- Track whether a flush has occurred in the current compaction cycle to avoid duplicate flushes
- Reset the flush flag when a new session starts or after post-compact fires
- Store the last flush timestamp for diagnostics
