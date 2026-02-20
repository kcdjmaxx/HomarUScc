# CompactionManager
**Requirements:** R75, R76, R77, R78, R79, R80, R81
**Refs:** ref-claude-code-hooks, ref-openclaw-compaction

## Knows
- flushedThisCycle: boolean — whether a pre-compact flush has already fired in this compaction cycle
- lastFlushTimestamp: number — epoch ms of the last flush
- logger: Logger

## Does
- handlePreCompact: generate flush prompt with recent session context; mark flushedThisCycle = true; log event; return prompt text
- handlePostCompact: gather critical re-injection context (active timers, recent memory keys, identity paths); reset flushedThisCycle; log event; return context text
- getFlushState: return { flushedThisCycle, lastFlushTimestamp } for diagnostics

## Collaborators
- HomarUScc: provides access to timer service, memory index, identity manager, event history
- DashboardServer: mounts the /api/pre-compact and /api/post-compact endpoints
- EventBus: receives logged pre-compact and post-compact events
- TranscriptLogger: flush transcript buffer during pre-compaction

## Sequences
- seq-compaction-flush.md
