# Sequence: Compaction Flush
**Requirements:** R75, R76, R77, R78, R79, R80

## Pre-Compact Flow

```
ClaudeCode            Hook(curl)         DashboardServer     CompactionManager    HomarUScc
    |                     |                    |                    |                  |
    |--auto-compact------>|                    |                    |                  |
    |  (PreCompact hook)  |                    |                    |                  |
    |                     |--GET /api/-------->|                    |                  |
    |                     |  pre-compact       |                    |                  |
    |                     |                    |--handlePreCompact->|                  |
    |                     |                    |                    |--getTimerNames-->|
    |                     |                    |                    |--getMemoryStats->|
    |                     |                    |                    |--getEventHistory>|
    |                     |                    |                    |<--data-----------|
    |                     |                    |<--flush prompt-----|                  |
    |                     |<--200 text---------|                    |                  |
    |<--stdout injected---|                    |                    |                  |
    |                     |                    |                    |                  |
    |  (agent sees flush prompt in context,    |                    |                  |
    |   saves important info via memory_store) |                    |                  |
    |                     |                    |                    |                  |
    |--compaction runs--->|                    |                    |                  |
```

## Post-Compact Flow

```
ClaudeCode            Hook(curl)         DashboardServer     CompactionManager    HomarUScc
    |                     |                    |                    |                  |
    |--session resumes--->|                    |                    |                  |
    |  (SessionStart      |                    |                    |                  |
    |   compact matcher)  |                    |                    |                  |
    |                     |--GET /api/-------->|                    |                  |
    |                     |  post-compact      |                    |                  |
    |                     |                    |--handlePostCompact>|                  |
    |                     |                    |                    |--getTimerNames-->|
    |                     |                    |                    |--getMemoryKeys-->|
    |                     |                    |                    |--getIdentity---->|
    |                     |                    |                    |<--data-----------|
    |                     |                    |<--context text-----|                  |
    |                     |<--200 text---------|                    |                  |
    |<--stdout injected---|                    |                    |                  |
    |  (verbatim in fresh context)             |                    |                  |
```

## Notes

- Pre-compact stdout is injected into context that will be summarized (lossy)
- Post-compact stdout is injected verbatim into fresh context (survives intact)
- flushedThisCycle prevents duplicate flushes within same compaction cycle
- Pre-compact prompt instructs the agent to save session state, not the hook itself
