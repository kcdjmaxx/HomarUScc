# Sequence: Agent Dispatch Flow

**Requirements:** R133, R134, R135, R136, R140, R141, R144, R145

## Dispatch Heavy Task

```
Max             Claude(main)      DashboardServer     AgentRegistry
 |                  |                   |                   |
 |--"research X"--->|                   |                   |
 |                  |                   |                   |
 |  [decide: heavy task → dispatch]     |                   |
 |                  |                   |                   |
 |                  |  POST /agents     |                   |
 |                  |  {id, desc}       |                   |
 |                  |------------------>|                   |
 |                  |                   |--register()------->|
 |                  |                   |<--ok (or full)----|
 |                  |<--200 / 429-------|                   |
 |                  |                   |                   |
 |  [if ok: spawn Task agent in background]                |
 |  [agent prompt includes callback:                       |
 |   curl POST /api/agents/{id}/complete]                  |
 |                  |                   |                   |
 |<-"On it, working |                   |                   |
 |   in background" |                   |                   |
 |                  |                   |                   |
 |  [restart event loop — stays responsive]                |
```

## Agent Completes (callback)

```
Agent(bg)       DashboardServer     AgentRegistry       Claude(main)
 |                   |                   |                   |
 [agent finishes]    |                   |                   |
 |                   |                   |                   |
 |  POST /agents/id/complete            |                   |
 |  {result: "..."}  |                   |                   |
 |------------------>|                   |                   |
 |                   |--complete(id,res)->|                   |
 |                   |  [emit agent_completed]              |
 |                   |<--ok-------------|                   |
 |<--200-------------|                   |                   |
 |                   |                   |                   |
 |                   |  [event wakes main loop via /api/wait]|
 |                   |                   |------------------>|
 |                   |                   |                   |
 |                   |                   |  [summarize + send]
 |                   |                   |                   |
 |                   |<--telegram_send---|                   |
Max<-----------------|  "Research done:" |                   |
 |                   |                   |                   |
 |  [restart event loop]               |                   |
```

## Timeout Fallback

```
AgentRegistry                    Claude(main)
 |                                   |
 [timeout checker fires every 60s]   |
 |                                   |
 [agent running > 30 min]            |
 |--emit agent_timeout-------------->|
 |                                   |
 [main loop handles timeout event]   |
```

## Concurrency Limit Hit

```
Claude(main)      DashboardServer     AgentRegistry
  |                   |                   |
  |  POST /agents     |                   |
  |  {id, desc}       |                   |
  |------------------>|                   |
  |                   |--register()------->|
  |                   |  [at capacity]     |
  |                   |<--false-----------|
  |<--429 (full)------|                   |
  |                   |                   |
  [handle inline or queue for later]      |
```
