# Backend
**Requirements:** R10, R11, R12, R13, R14

## Knows
- loop: HomarUScc event loop
- dashboardServer: DashboardServer (Express + WebSocket)
- logger: stderr Logger

## Does
- main: create logger, HomarUScc, DashboardAdapter, DashboardServer, start all
- wire TelegramCommandHandler with CommandContext exposing status, compaction stats, `/missed`, `/resolve`, and `listOpenConflicts` hooks into ConflictMonitor
- optional personal-extensions: dynamic import of `./personal-extensions.js` (gitignored) inside try/catch. If present, its `register(loop, logger)` is called. Missing module is a no-op — fresh clones of the public repo run without extensions. Lets business-specific pipelines (Fric & Frac hiring, reports) live outside the public tree.
- shutdown: graceful stop on SIGINT/SIGTERM

## Collaborators
- HomarUScc: event loop lifecycle
- DashboardServer: HTTP API + WebSocket (serves proxy and dashboard clients)
- DashboardAdapter: dashboard channel for chat messages
- TelegramCommandHandler: slash-command interception; receives a CommandContext bag
- ConflictMonitor (via loop): `/missed`, `/resolve`, `listOpenConflicts` route here
- Personal extensions (optional, gitignored): hiring pipeline, report pipeline, etc.

## Sequences
- seq-startup.md
