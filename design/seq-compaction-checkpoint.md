# Sequence: Compaction with Session Checkpoint

**Requirements:** R124, R125, R128, R129, R130

## Pre-Compaction Save

```
Claude          DashboardServer    CompactionManager    SessionCheckpoint
  |                   |                   |                   |
  |--[event handled]->|                   |                   |
  |  POST /checkpoint |                   |                   |
  |  {currentTopic,   |                   |                   |
  |   recentMessages} |                   |                   |
  |------------------>|                   |                   |
  |                   |---update(partial)----------------->  |
  |                   |                   |            [merge + write]
  |                   |<--ok--------------|                   |
  |<--200-------------|                   |                   |
  |                   |                   |                   |
  [compaction starts] |                   |                   |
  |                   |                   |                   |
Hook: pre-compact     |                   |                   |
  |  GET /pre-compact |                   |                   |
  |------------------>|                   |                   |
  |                   |--handlePreCompact()                  |
  |                   |------------------>|                   |
  |                   |                   |---update(files)-->|
  |                   |                   |  [save modifiedFiles]
  |                   |<--prompt text-----|                   |
  |<--prompt text-----|                   |                   |
```

## Post-Compaction Reload

```
Claude          DashboardServer    CompactionManager    SessionCheckpoint
  |                   |                   |                   |
  [compaction done]   |                   |                   |
  |                   |                   |                   |
Hook: post-compact    |                   |                   |
  |  GET /post-compact|                   |                   |
  |------------------>|                   |                   |
  |                   |--handlePostCompact()                 |
  |                   |------------------>|                   |
  |                   |                   |--toContextString->|
  |                   |                   |                   |
  |                   |                   |<--checkpoint text-|
  |                   |                   |  [system state +  |
  |                   |                   |   checkpoint]     |
  |                   |<--context text----|                   |
  |<--context text----|                   |                   |
  |                   |                   |                   |
  [Claude re-orients with checkpoint context]                |
  |  restart event loop                   |                   |
```

## Session End Cleanup

```
Claude          DashboardServer    SessionCheckpoint
  |                   |                   |
  [session ending]    |                   |
  | DELETE /checkpoint|                   |
  |------------------>|                   |
  |                   |---clear()-------->|
  |                   |            [delete file]
  |                   |<--ok-------------|
  |<--200-------------|                   |
```
