# TimerService
**Requirements:** R42, R43, R44, R45, R46, R47
**Refs:** ref-croner

## Knows
- timers: map of timer ID → timer config + runtime handle
- storePath: JSON file path for persistence
- emitter: callback to emit events into the loop
- running: whether the service is active

## Does
- add: create timer (cron/interval/once), dedup by name, persist, return ID
- remove: cancel timer handle, delete from store, persist
- get / getAll: timer lookup
- loadTimers: read persisted JSON, recreate handles, clean expired one-shots
- saveTimers: write current timers to JSON file
- start: activate all timer handles
- stop: cancel all timer handles
- fire: emit timer_fired event, auto-delete one-shots

## Collaborators
- HomarUScc: receives timer_fired events via emitter callback

## Sequences
- seq-timer-fire.md
