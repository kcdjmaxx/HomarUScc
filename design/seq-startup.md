# Sequence: Startup

## Single-process mode (mcp-server.ts)

```
McpServer           HomarUScc        Config       Identity     Memory       Skills       Timers       Channels     Dashboard
    |                   |               |            |            |            |            |            |            |
    |--start()--------->|               |            |            |            |            |            |            |
    |                   |--load()------>|            |            |            |            |            |            |
    |                   |<--ConfigData--|            |            |            |            |            |            |
    |                   |               |            |            |            |            |            |            |
    |                   |--load()--------------------->|           |            |            |            |            |
    |                   |<--soul+user-------------------|          |            |            |            |            |
    |                   |               |            |            |            |            |            |            |
    |                   |--initialize()------------------------------>|         |            |            |            |
    |                   |<--db ready---------------------------------|         |            |            |            |
    |                   |               |            |            |            |            |            |            |
    |                   |--registerBuiltinTools()     |            |            |            |            |            |
    |                   |               |            |            |            |            |            |            |
    |                   |--loadAll()------------------------------------------>|            |            |            |
    |                   |<--skills loaded------------------------------------ -|            |            |            |
    |                   |               |            |            |            |            |            |            |
    |                   |--loadTimers()+start()------------------------------------------------>|       |            |
    |                   |<--timers active--------------------------------------------------- ---|       |            |
    |                   |               |            |            |            |            |            |            |
    |                   |--loadAdapters()+connectAll()------------------------------------------------------>|       |
    |                   |<--channels connected--------------------------------------------------------------|       |
    |                   |               |            |            |            |            |            |            |
    |                   |--start()--------------------------------------------------------------------------------->|
    |                   |<--dashboard listening----------------------------------------------------------------------|
    |                   |               |            |            |            |            |            |            |
    |                   |--startProcessing() (50ms interval)      |            |            |            |            |
    |                   |--startWatching()-->|       |            |            |            |            |            |
    |<--"running"-------|               |            |            |            |            |            |            |
```

## Two-process mode (mcp-proxy.ts + backend.ts)

```
Claude Code      McpProxy         BackendManager      Backend(process)     Dashboard
    |               |                   |                    |                  |
    |--stdio------->|                   |                    |                  |
    |               |--spawn()--------->|                    |                  |
    |               |                   |--child_process.--->|                  |
    |               |                   |   spawn("node",    |                  |
    |               |                   |   "backend.js")    |                  |
    |               |                   |                    |--HomarUScc------>|
    |               |                   |                    |  start()         |
    |               |                   |                    |<--listening------|
    |               |                   |                    |                  |
    |               |                   |--GET /api/health-->|                  |
    |               |                   |  (poll 200ms)      |                  |
    |               |                   |<--{ok:true}--------|                  |
    |               |<--"healthy"-------|                    |                  |
    |               |                   |                    |                  |
    |               |--ws connect------>|================WebSocket============>|
    |               |<--event relay-----|                    |                  |
    |               |                   |                    |                  |
    |<--"connected"-|                   |                    |                  |
    |               |                   |                    |                  |
    |--ListTools--->|                   |                    |                  |
    |               |--GET /api/tool-list------------------->|                  |
    |               |<--tools[]------------------------------|                  |
    |               |  (+ restart_backend injected)          |                  |
    |<--tools[]-----|                   |                    |                  |
    |               |                   |                    |                  |
    |--CallTool---->|                   |                    |                  |
    |  "get_status" |--POST /api/tool-call------------------>|                  |
    |               |<--result-------------------------------|                  |
    |<--result------|                   |                    |                  |
    |               |                   |                    |                  |
    |--CallTool---->|                   |                    |                  |
    |  "restart_    |--restart()------->|                    |                  |
    |   backend"    |                   |--SIGTERM---------->|                  |
    |               |                   |<--exit-------------|                  |
    |               |                   |--spawn()---------->|(new process)     |
    |               |                   |--GET /api/health-->|                  |
    |               |                   |<--{ok:true}--------|                  |
    |               |<--"restarted"-----|                    |                  |
    |<--"success"---|                   |                    |                  |
```
