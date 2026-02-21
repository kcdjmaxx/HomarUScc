# AgentRegistry
**Requirements:** R136, R137, R138, R139, R140, R141, R146, R147
**Refs:** ref-claude-code-task-tool

## Knows
- agents: Map<string, AgentEntry> — tracked background agents
- maxConcurrent: number — from config (default 3)
- emitter: (event: Event) => void — callback to emit events into the loop

## Does
- register(id, description, outputFile): boolean — Adds agent to registry. Returns false if at capacity.
- getAll(): AgentEntry[] — Returns all tracked agents
- get(id): AgentEntry | null — Returns specific agent
- complete(id, result): void — Marks agent as completed, emits `agent_completed` event, schedules cleanup
- fail(id, error): void — Marks agent as failed, emits `agent_failed` event
- getAvailableSlots(): number — Returns maxConcurrent minus active count
- cleanup(id): void — Removes agent from registry after result delivery

## Collaborators
- HomarUScc: provides event emitter, loads config for maxConcurrent
- DashboardServer: exposes REST endpoints for agent lifecycle

## Sequences
- seq-agent-dispatch.md
