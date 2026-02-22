# AgentRegistry
**Requirements:** R136, R137, R138, R139, R140, R141, R146, R147
**Refs:** ref-claude-code-task-tool

## Knows
- agents: Map<string, AgentEntry> — tracked background agents
- maxConcurrent: number — from config (default 3)
- emitter: (event: Event) => void — callback to emit events into the loop
- timeoutMs: number — how long before a running agent is timed out (default 30 min)
- timeoutTimer: NodeJS.Timeout | null — periodic check for timed-out agents

## Does
- register(id, description): boolean — Adds agent to registry. Returns false if at capacity. Starts timeout checker.
- getAll(): AgentEntry[] — Returns all tracked agents
- get(id): AgentEntry | null — Returns specific agent
- complete(id, result): void — Marks agent as completed, emits `agent_completed` event. Called via POST /api/agents/:id/complete callback.
- fail(id, error): void — Marks agent as failed, emits `agent_failed` event
- getAvailableSlots(): number — Returns maxConcurrent minus active count
- cleanup(id): void — Removes agent from registry after result delivery
- stop(): void — Clears the timeout checker interval

## Collaborators
- HomarUScc: provides event emitter, loads config for maxConcurrent
- DashboardServer: exposes REST endpoints for agent lifecycle including POST /api/agents/:id/complete callback

## Sequences
- seq-agent-dispatch.md

## Completion Detection
Agents signal completion by calling `POST /api/agents/:id/complete` with `{ result: "summary" }` when they finish.
A timeout fallback (30 min default) catches agents that fail to call back.
