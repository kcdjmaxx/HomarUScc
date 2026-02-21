# Agent Dispatcher

**Language:** TypeScript (backend tracking) + Claude Code skill prompt (dispatch logic)
**Environment:** Node.js (HomarUScc backend) + Claude Code Task tool

## Problem

Heavy tasks (research, mini-spec cycles, file processing, dream cycles) run in the main Claude Code context window, consuming tokens and blocking message handling. This causes:
- Rapid context exhaustion leading to compaction
- Unresponsiveness while tasks execute (Max can't message during a 20-step mini-spec)
- All work lost if compaction hits mid-task

## Solution

An agent dispatcher pattern where:
1. The main event loop stays lean — handles messages, makes quick decisions, dispatches work
2. Heavy tasks are spawned as background Claude Code Task agents with isolated context windows
3. The main loop continues handling incoming messages while agents work
4. Agent results are routed back through the HomarUScc event system
5. Max gets notified of agent completions via Telegram/dashboard

## Architecture

### Dispatch Decision (Claude-side, in skill prompt)

When a message or timer arrives, Claude evaluates:
- **Inline**: Quick responses, simple lookups, memory searches — handle directly
- **Dispatch**: Research tasks, multi-step workflows, file-heavy operations — spawn a background agent

The skill prompt provides heuristics for this decision.

### Agent Lifecycle

1. **Spawn**: Main loop calls Task tool with `run_in_background: true`, providing:
   - Task description and all necessary context
   - Instructions to write results to a known file path
   - The HomarUScc backend URL for result routing

2. **Track**: Backend maintains an agent registry:
   - Agent ID (from Task tool response)
   - Task description
   - Status (running, completed, failed)
   - Start time
   - Output file path

3. **Monitor**: Main loop periodically checks agent status via `TaskOutput` (non-blocking)

4. **Complete**: When an agent finishes:
   - Main loop reads the result
   - Routes it through the event system as an `agent_completed` event
   - Notifies Max via Telegram/dashboard with a summary
   - Updates the agent registry

### Backend Components

The backend tracks agents via a new REST endpoint and in-memory registry:

- `POST /api/agents` — Register a new agent (id, description, outputFile)
- `GET /api/agents` — List all tracked agents with status
- `PATCH /api/agents/:id` — Update agent status (completed/failed) with result
- `DELETE /api/agents/:id` — Remove completed agent from registry

When an agent is marked completed, the backend emits an `agent_completed` event into the event system, which wakes the main loop via `/api/wait`.

### Concurrency Control

- Config: `agents.maxConcurrent` (default 3)
- When max is reached, new tasks queue until a slot opens
- The backend enforces the limit; Claude reads it from config

### Agent Context

Spawned agents receive:
- The task prompt
- Relevant memory search results (pre-fetched by main loop)
- File paths they need to read
- Instructions NOT to send messages directly — write results to the output mechanism

Agents do NOT receive:
- Identity/soul context (they're workers, not Caul)
- Direct Telegram/dashboard access
- The full conversation history

## Event Flow

```
Max sends message → Main loop handles it
  → Decides it needs research
  → Spawns background agent
  → Sends "On it, I'll research that in the background" via Telegram
  → Restarts event loop (stays responsive)

[Agent works in background — zero main-loop tokens]

Agent finishes → Main loop wakes (agent_completed event)
  → Reads agent result
  → Summarizes and sends to Max via Telegram
  → Restarts event loop
```

## Config

```json
{
  "agents": {
    "maxConcurrent": 3,
    "defaultModel": "sonnet",
    "defaultType": "general-purpose"
  }
}
```
