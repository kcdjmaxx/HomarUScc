# Test Design: TranscriptLogger

**Source:** crc-TranscriptLogger.md

## Test: Inbound messages are buffered

**Purpose:** Verify that inbound message events get captured as transcript turns
**Input:** Emit a message event with channel "telegram", text "hello", sender "Max"
**Expected:** Buffer contains one turn with direction "in", channel "telegram", text "hello"
**Refs:** crc-TranscriptLogger.md, R98

## Test: Outbound messages are buffered

**Purpose:** Verify that outbound send calls get captured as transcript turns
**Input:** Call logOutbound with channel "telegram", text "Hi Max"
**Expected:** Buffer contains one turn with direction "out", channel "telegram", text "Hi Max"
**Refs:** crc-TranscriptLogger.md, R99

## Test: Flush writes dated markdown file

**Purpose:** Verify flush creates a properly formatted markdown file with date-based name
**Input:** Buffer 2 turns (one in, one out), call flush
**Expected:** File `YYYY-MM-DD.md` created in transcript directory with markdown-formatted turns. Buffer is cleared.
**Refs:** crc-TranscriptLogger.md, R100, R101

## Test: Flush indexes via MemoryIndex

**Purpose:** Verify flushed transcript file gets indexed for search
**Input:** Buffer 1 turn, call flush with a mock MemoryIndex
**Expected:** MemoryIndex.indexFile called with the transcript file path
**Refs:** crc-TranscriptLogger.md, R104

## Test: Empty buffer does not flush

**Purpose:** Verify no file write occurs when buffer is empty
**Input:** Empty buffer, call flush
**Expected:** No file created, no indexFile call
**Refs:** crc-TranscriptLogger.md, R102

## Test: Multiple sessions append to same daily file

**Purpose:** Verify that flushing twice on the same day appends rather than overwrites
**Input:** Flush with 1 turn, then flush with another turn (same day)
**Expected:** File contains both turns
**Refs:** crc-TranscriptLogger.md, R100

## Test: Flush on shutdown

**Purpose:** Verify stop() flushes remaining buffer
**Input:** Buffer 2 turns, call stop()
**Expected:** Turns written to file before stop completes
**Refs:** crc-TranscriptLogger.md, R103

## Test: Directory created on first flush

**Purpose:** Verify transcript directory is created if it doesn't exist
**Input:** Non-existent transcript directory, buffer 1 turn, flush
**Expected:** Directory created, file written successfully
**Refs:** crc-TranscriptLogger.md, R106
