# Event Loop

**Language:** TypeScript
**Environment:** Node.js >= 22, MCP stdio server

HomarUScc is an event-driven MCP server. The event loop is the central orchestrator that ties all subsystems together.

## Behavior

- On startup, the loop initializes all subsystems in order: config, identity, memory, browser, tools, skills, timers, channels.
- Events arrive from channels (Telegram messages, dashboard chat), timers (cron/interval/once firing), and skills (custom events).
- Events are enqueued into a priority queue and processed every 50ms.
- Each event is routed through the EventBus to registered handlers.
- Events that have no direct handler, or that have agent-type handlers, are forwarded to Claude Code via an MCP notification callback.
- The loop maintains a history of the last 100 events for introspection.
- Long-poll waiters can block until new events arrive or a timeout expires.
- On shutdown, the loop drains the queue, resolves blocked waiters, disconnects channels, stops timers, and closes all services.

## Event Structure

Each event has: id (UUID), type (string), source (string), timestamp (epoch ms), payload (any), and optional replyTo and priority fields.

## Priority Queue

Events are dequeued highest-priority-first. On overflow (default 1000), the strategy can drop the lowest priority event, delay, or reject.
