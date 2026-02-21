# SessionCheckpoint
**Requirements:** R124, R125, R126, R127, R128, R129, R130, R131, R132
**Refs:** ref-claude-code-hooks

## Knows
- checkpointPath: string — file path (`~/.homaruscc/checkpoint.json`)
- currentData: CheckpointData | null — in-memory checkpoint state

## Does
- update(partial): void — Merges partial data into current checkpoint, writes to disk
- load(): CheckpointData | null — Reads checkpoint from disk, returns null if absent
- clear(): void — Deletes checkpoint file (called on clean session end)
- toContextString(): string — Formats checkpoint as human-readable text for post-compact injection

## Collaborators
- CompactionManager: calls update() during pre-compact, calls toContextString() during post-compact
- DashboardServer: exposes POST/GET /api/checkpoint endpoints that delegate to this class

## Sequences
- seq-compaction-checkpoint.md
