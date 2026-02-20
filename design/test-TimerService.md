# Test Design: TimerService
**Source:** crc-TimerService.md

## Test: add and fire interval timer
**Purpose:** Interval timer fires and emits timer_fired event
**Input:** Add interval timer with 100ms schedule
**Expected:** timer_fired event emitted with {timerId, name, prompt}
**Refs:** crc-TimerService.md, seq-timer-fire.md

## Test: dedup by name
**Purpose:** Adding timer with existing name replaces old timer
**Input:** Add timer "foo", add another timer "foo" with different schedule
**Expected:** Only one timer named "foo" exists, old one cancelled
**Refs:** crc-TimerService.md

## Test: one-shot auto-delete
**Purpose:** Once timers are removed after firing
**Input:** Add once timer with near-future timestamp
**Expected:** Timer fires, then getAll() no longer includes it
**Refs:** crc-TimerService.md

## Test: persistence round-trip
**Purpose:** Timers survive save/load cycle
**Input:** Add timers, save, create new service, load
**Expected:** All timers restored with correct config
**Refs:** crc-TimerService.md
