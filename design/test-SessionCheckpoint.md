# Test Design: SessionCheckpoint
**Source:** crc-SessionCheckpoint.md

## Test: update merges partial data
**Purpose:** Verify that partial updates merge with existing checkpoint data
**Input:** update({currentTopic: "A"}), then update({inProgressTask: "B"})
**Expected:** Checkpoint contains both currentTopic: "A" and inProgressTask: "B"
**Refs:** crc-SessionCheckpoint.md

## Test: update writes to disk
**Purpose:** Verify checkpoint persists to file
**Input:** update({currentTopic: "test"}), then load() after clearing in-memory state
**Expected:** load() returns data with currentTopic: "test"
**Refs:** crc-SessionCheckpoint.md

## Test: clear deletes checkpoint
**Purpose:** Verify clean session end removes checkpoint
**Input:** update({currentTopic: "test"}), then clear()
**Expected:** load() returns null, file does not exist
**Refs:** crc-SessionCheckpoint.md

## Test: toContextString formats readably
**Purpose:** Verify checkpoint renders as human-readable context text
**Input:** update({currentTopic: "building agents", recentDecisions: ["use sonnet"], inProgressTask: "design phase"})
**Expected:** toContextString() includes all fields in a clear format
**Refs:** crc-SessionCheckpoint.md

## Test: recentDecisions caps at 10
**Purpose:** Verify the max 10 decisions limit
**Input:** update with 15 decisions
**Expected:** Only last 10 are retained
**Refs:** crc-SessionCheckpoint.md
