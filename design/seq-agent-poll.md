# Sequence: Agent Completion Polling

**Requirements:** R154, R155, R156, R157, R158, R159, R160, R161, R162

## Polling Cycle (every pollIntervalMs)

```
AgentRegistry                    FileSystem
  |                                  |
  |--[for each running agent         |
  |   with outputFile]               |
  |                                  |
  |--statSync(outputFile)----------->|
  |<--{size, mtimeMs}---------------|
  |                                  |
  |  [if size == 0: skip]            |
  |  [if stat throws: log, skip]     |
  |                                  |
  |--readTail(outputFile, 512)------>|
  |<--tailBytes---------------------|
  |                                  |
  |  [check tail for completion      |
  |   markers: "stop_reason":        |
  |   "end_turn" or "type":"result"] |
  |                                  |
  |  [if marker found OR             |
  |   mtime stable > 10s]:           |
  |                                  |
  |--complete(id, tailSummary)       |
  |  [emit agent_completed event]    |
  |  [main loop wakes via /api/wait] |
```

## Startup / Shutdown

```
HomarUScc           AgentRegistry
  |                     |
  |--startPolling()---->|
  |                     |--setInterval(pollAgents, pollIntervalMs)
  |                     |
  |  [...time passes, agents registered/completed...]
  |                     |
  |--stopPolling()----->|
  |                     |--clearInterval(pollTimer)
  |                     |  [pollTimer = null]
```

## File Not Ready (Skip)

```
AgentRegistry                    FileSystem
  |                                  |
  |--statSync(outputFile)----------->|
  |<--ENOENT (file not found)--------|
  |  [log debug, skip]              |
  |                                  |
  |--statSync(outputFile2)---------->|
  |<--{size: 0}---------------------|
  |  [empty file, skip]             |
  |                                  |
  |--statSync(outputFile3)---------->|
  |<--{size: 500, mtimeMs: now-2s}--|
  |  [mtime too recent, check tail]  |
  |--readTail(outputFile3, 512)----->|
  |<--tail (no completion marker)----|
  |  [no marker + mtime recent, skip]|
```
