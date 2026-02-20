# Backend
**Requirements:** R10, R11, R12, R13, R14

## Knows
- loop: HomarUScc event loop
- dashboardServer: DashboardServer (Express + WebSocket)
- logger: stderr Logger

## Does
- main: create logger, HomarUScc, DashboardAdapter, DashboardServer, start all
- shutdown: graceful stop on SIGINT/SIGTERM

## Collaborators
- HomarUScc: event loop lifecycle
- DashboardServer: HTTP API + WebSocket (serves proxy and dashboard clients)
- DashboardAdapter: dashboard channel for chat messages

## Sequences
- seq-startup.md
