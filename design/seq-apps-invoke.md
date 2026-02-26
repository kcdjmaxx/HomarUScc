# Sequence: App Hook Invocation via MCP Tool
**Requirements:** R189, R190, R191, R192, R193, R196, R209

```
Claude Code       MCP (app_invoke)    AppDataStore         DashboardServer    FileSystem
    |                   |                  |                     |                |
    |-- app_invoke ---->|                  |                     |                |
    |   {slug,hook,data}|                  |                     |                |
    |                   |-- invoke() ----->|                     |                |
    |                   |                  |                     |                |
    |                   |   [hook=read]    |                     |                |
    |                   |                  |-- readFileSync ---->|                |
    |                   |                  |   data.json         |                |
    |                   |                  |<-- JSON object -----|                |
    |                   |<-- {data} -------|                     |                |
    |                   |                  |                     |                |
    |                   |   [hook=write]   |                     |                |
    |                   |                  |-- writeFileSync --->|                |
    |                   |                  |   data.json         |                |
    |                   |<-- {ok:true} ----|                     |                |
    |                   |                  |                     |                |
    |                   |   [hook=describe]|                     |                |
    |                   |                  |-- read(slug) ------>|                |
    |                   |                  |-- format summary    |                |
    |                   |<-- {text:"..."} -|                     |                |
    |                   |                  |                     |                |
    |<-- result --------|                  |                     |                |
```

Notes:
- `app_invoke` is a single MCP tool that multiplexes across all apps and hooks
- The `describe` hook generates a summary from the data structure -- formatted text of keys and values
- Write hook replaces the entire data.json contents
- Tool returns standard MCP content format: `{content: [{type: "text", text: ...}]}`
- AppDataStore reads/writes directly to ~/.homaruscc/apps/{slug}/data.json
