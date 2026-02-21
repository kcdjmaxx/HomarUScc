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
 |                  |  {id, desc, file} |                   |
 |                  |------------------>|                   |
 |                  |                   |--register()------->|
 |                  |                   |<--ok (or full)----|
 |                  |<--200 / 429-------|                   |
 |                  |                   |                   |
 |  [if ok: spawn Task agent in background]                |
 |                  |                   |                   |
 |<-"On it, working |                   |                   |
 |   in background" |                   |                   |
 |                  |                   |                   |
 |  [restart event loop — stays responsive]                |
```

## Agent Completes

```
Agent(bg)       Claude(main)      DashboardServer     AgentRegistry
 |                  |                   |                   |
 [agent finishes]   |                   |                   |
 |                  |                   |                   |
 |  [main loop checks TaskOutput]      |                   |
 |                  |                   |                   |
 |--result--------->|                   |                   |
 |                  |                   |                   |
 |                  |  PATCH /agents/id |                   |
 |                  |  {status, result} |                   |
 |                  |------------------>|                   |
 |                  |                   |--complete(id,res)->|
 |                  |                   |  [emit agent_completed]
 |                  |                   |<--ok-------------|
 |                  |<--200-------------|                   |
 |                  |                   |                   |
 |                  |--telegram_send--->|                   |
 |                  |  "Research done:  |                   |
Max<----------------|   [summary]"      |                   |
 |                  |                   |                   |
 |  [restart event loop]               |                   |
```

## Concurrency Limit Hit

```
Claude(main)      DashboardServer     AgentRegistry
  |                   |                   |
  |  POST /agents     |                   |
  |  {id, desc, file} |                   |
  |------------------>|                   |
  |                   |--register()------->|
  |                   |  [at capacity]     |
  |                   |<--false-----------|
  |<--429 (full)------|                   |
  |                   |                   |
  [handle inline or queue for later]      |
```
