# Test Design: EventQueue
**Source:** crc-EventQueue.md

## Test: enqueue and dequeue FIFO
**Purpose:** Events with same priority dequeue in insertion order
**Input:** Enqueue events A, B, C with priority 0
**Expected:** Dequeue returns A, B, C in order
**Refs:** crc-EventQueue.md

## Test: priority ordering
**Purpose:** Higher priority events dequeue first
**Input:** Enqueue event A (priority 0), B (priority 10), C (priority 5)
**Expected:** Dequeue returns B, C, A
**Refs:** crc-EventQueue.md

## Test: overflow drop_lowest
**Purpose:** Queue drops lowest priority event when full
**Input:** Fill queue to maxSize, enqueue high-priority event
**Expected:** Lowest priority event removed, new event present
**Refs:** crc-EventQueue.md

## Test: clear returns all events
**Purpose:** Clear drains queue and returns remaining events
**Input:** Enqueue 3 events, call clear()
**Expected:** Returns array of 3 events, size() is 0
**Refs:** crc-EventQueue.md
