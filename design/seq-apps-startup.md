# Sequence: App Registry Startup
**Requirements:** R197, R201, R204, R205, R386, R387

```
Backend (backend.ts)          DashboardServer           FileSystem
    |                              |                       |
    |-- new DashboardServer() ---->|                       |
    |                              |                       |
    |   (during setupRoutes):      |                       |
    |                              |-- resolve appsDir --->|
    |                              |   (~/.homaruscc/apps/) |
    |                              |                       |
    |   GET /api/apps arrives:     |                       |
    |                              |-- existsSync(dir) --->|
    |                              |   [if !exists]        |
    |                              |<-- false -------------|
    |                              |-- return [] --------->|
    |                              |                       |
    |                              |   [if exists]         |
    |                              |-- readdirSync(dir) -->|
    |                              |<-- [budget/, list/] --|
    |                              |                       |
    |                              |-- for each subdir:    |
    |                              |   readFile(manifest)->|
    |                              |<-- JSON or error -----|
    |                              |   (skip invalid,R206) |
    |                              |                       |
    |                              |-- return manifests -->|
    |                              |                       |
```

Notes:
- No separate AppRegistry class is instantiated. DashboardServer handles manifest scanning inline in the /api/apps route handler.
- App directory is resolved from homedir() + .homaruscc/apps/ (R204)
- Each request re-scans the directory, providing eventual consistency without a file watcher
- Invalid manifests are caught and skipped silently (R206)
- A separate AppRegistry class (src/app-registry.ts) can be extracted as a refactor to move scanning logic out of DashboardServer
