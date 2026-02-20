# TranscriptLogger
**Requirements:** R98, R99, R100, R101, R102, R103, R104, R105, R106, R107, R108

## Knows
- buffer: array of transcript turns (timestamp, channel, direction, sender, text)
- transcriptDir: path to transcript storage directory
- flushIntervalMs: how often to auto-flush (default 300000 = 5 minutes)
- flushTimer: interval handle for periodic flushing
- enabled: whether transcript capture is active
- logger: Logger

## Does
- start: begin listening for events and schedule periodic flush
- stop: flush remaining buffer and cancel timer
- logInbound: capture an inbound message event as a transcript turn
- logOutbound: capture an outbound send (telegram_send, dashboard_send) as a transcript turn
- flush: write buffered turns to a dated markdown file and index it via MemoryIndex
- getBufferSize: return number of buffered turns (for diagnostics)

## Collaborators
- EventBus: listens for inbound message events
- MemoryIndex: indexes flushed transcript files for search
- HomarUScc: provides event bus and memory index references
- CompactionManager: triggers flush during pre-compaction

## Sequences
- seq-transcript-capture.md
