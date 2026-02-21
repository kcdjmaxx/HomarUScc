# Agent Completion Polling

**Language:** TypeScript
**Environment:** Node.js (HomarUScc backend)

## Problem

When a background Task agent is spawned and registered in the AgentRegistry with an outputFile, the backend has no way to detect when the agent finishes writing. The main event loop blocks on `/api/wait` and only wakes when another event arrives. This creates a gap: the agent completes, but the main loop does not learn about it until something else happens.

## Solution

Add a file-polling mechanism to AgentRegistry. When an agent is registered with an `outputFile`, the registry starts polling that file using `statSync`. When the file appears to be complete (stable modification time + completion marker in the file), the registry calls `complete()` which emits `agent_completed` into the event system, waking the main loop.

## Polling Behavior

- Poll interval: configurable via constructor parameter (default 5000ms)
- Only poll agents that have an `outputFile` set
- Detection strategy: check if file has been written to (size > 0), then check if the last bytes contain a completion marker (`"stop_reason":"end_turn"` or `"type":"result"`) OR if the file has not been modified in 10 seconds (stable mtime)
- Read only the tail of the file (last 512 bytes) to check for markers, not the whole file
- On detection: call `complete(id, result)` with a summary extracted from the tail
- Only complete once per agent (skip agents already completed/failed)
- Clear polling interval on `cleanup(id)` and on `stop()`

## Lifecycle

- `startPolling()` — begins the global poll interval, called during backend startup
- `stopPolling()` — clears the interval, called during shutdown. Uses `clearInterval` so it does not keep the Node.js process alive.
- Registration of an agent with an outputFile automatically includes it in the next poll cycle (no per-agent interval)
- A single setInterval drives all agent polling (not one interval per agent)

## Edge Cases

- File does not exist yet: skip, check again next cycle
- File exists but is still being written: mtime is recent, skip
- `statSync` throws (file deleted, permission error): log warning, skip
- Agent already completed/failed: skip
- Multiple agents polling simultaneously: each checked independently in the same interval callback
