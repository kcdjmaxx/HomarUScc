# Sequence: Transcript Capture and Indexing

## Inbound Message Capture
```
Channel     EventBus     TranscriptLogger
   |            |              |
   |--event---->|              |
   | (message)  |--notify----->|
   |            |              |--logInbound()
   |            |              |  (add to buffer)
```

## Outbound Response Capture
```
McpTools     TranscriptLogger
   |              |
   |--logOutbound()
   | (telegram_send |
   |  or dashboard_ |
   |  send called)  |
   |              |--add to buffer
```

## Periodic Flush
```
Timer        TranscriptLogger    FS           MemoryIndex
  |               |               |               |
  |--interval---->|               |               |
  |               |--flush()      |               |
  |               |  (if buffer   |               |
  |               |   non-empty)  |               |
  |               |--write file-->|               |
  |               | (append to    |               |
  |               |  YYYY-MM-DD.md)               |
  |               |--indexFile()----------------->|
  |               |               |               |--chunk + embed
  |               |--clear buffer |               |
```

## Pre-Compaction Flush
```
CompactionManager    TranscriptLogger
       |                   |
       |--flush()--------->|
       |                   |--(same as periodic flush)
```
