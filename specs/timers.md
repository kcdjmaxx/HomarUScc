# Timers

**Language:** TypeScript
**Environment:** Node.js >= 22, croner

The timer service schedules recurring and one-shot events.

## Timer Types

- **Cron:** 5-field cron expressions with optional timezone (e.g., "0 9 * * MON" in "America/Chicago")
- **Interval:** Repeating at a fixed millisecond interval
- **Once:** Single fire at an ISO 8601 timestamp, auto-deleted after firing

## Behavior

- Timers are deduplicated by name — adding a timer with an existing name replaces the old one
- On fire, emits a "timer_fired" event with {timerId, name, prompt} payload
- Timers are persisted to a JSON file (default `~/.homaruscc/timers.json`) and restored on restart
- One-shot timers that have already passed their fire time are cleaned up on load

## MCP Tools

- `timer_schedule(name, type, schedule, prompt, timezone?)` — create or replace a timer
- `timer_cancel(name)` — remove a timer by ID or name
