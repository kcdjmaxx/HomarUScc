# AgentRegistry
**Requirements:** R136, R137, R138, R139, R140, R141, R146, R147, R154, R155, R156, R157, R158, R159, R160, R161, R162
**Refs:** ref-claude-code-task-tool

## Knows
- agents: Map<string, AgentEntry> — tracked background agents
- maxConcurrent: number — from config (default 3)
- emitter: (event: Event) => void — callback to emit events into the loop
- pollIntervalMs: number — how often to poll output files (default 5000)
- pollTimer: NodeJS.Timeout | null — the global polling interval handle
- stableThresholdMs: number — how long mtime must be stable to consider file complete (10000)

## Does
- register(id, description, outputFile): boolean — Adds agent to registry. Returns false if at capacity.
- getAll(): AgentEntry[] — Returns all tracked agents
- get(id): AgentEntry | null — Returns specific agent
- complete(id, result): void — Marks agent as completed, emits `agent_completed` event, schedules cleanup
- fail(id, error): void — Marks agent as failed, emits `agent_failed` event
- getAvailableSlots(): number — Returns maxConcurrent minus active count
- cleanup(id): void — Removes agent from registry after result delivery
- startPolling(): void — Starts a single global setInterval that checks all running agents with outputFiles
- stopPolling(): void — Clears the polling interval so it does not keep the process alive
- pollAgents(): void — Iterates running agents with outputFiles, checks file tail for completion markers or stable mtime

## Collaborators
- HomarUScc: provides event emitter, loads config for maxConcurrent, calls startPolling/stopPolling
- DashboardServer: exposes REST endpoints for agent lifecycle

## Sequences
- seq-agent-dispatch.md
- seq-agent-poll.md
