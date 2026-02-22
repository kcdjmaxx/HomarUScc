# Sequence: App Hook Invocation via MCP Tool
**Requirements:** R189, R190, R191, R192, R193, R196, R209

```
Claude Code          MCP (app_invoke)      AppDataStore         AppRegistry          FileSystem
    |                      |                    |                    |                    |
    |-- app_invoke ------->|                    |                    |                    |
    |   {slug, hook, data} |                    |                    |                    |
    |                      |-- get(slug) ------>|                    |                    |
    |                      |                    |                    |                    |
    |                      |   [if not found]   |                    |                    |
    |                      |<-- error ----------|                    |                    |
    |<-- "Unknown app" ----|                    |                    |                    |
    |                      |                    |                    |                    |
    |                      |   [if found]       |                    |                    |
    |                      |-- invoke(slug, --->|                    |                    |
    |                      |   hook, params)    |                    |                    |
    |                      |                    |                    |                    |
    |                      |   [hook=read]      |                    |                    |
    |                      |                    |-- readFileSync --->|                    |
    |                      |                    |   data.json        |                    |
    |                      |                    |<-- JSON object ----|                    |
    |                      |<-- {data} ---------|                    |                    |
    |                      |                    |                    |                    |
    |                      |   [hook=write]     |                    |                    |
    |                      |                    |-- writeFileSync -->|                    |
    |                      |                    |   data.json        |                    |
    |                      |<-- {ok: true} -----|                    |                    |
    |                      |                    |                    |                    |
    |                      |   [hook=describe]  |                    |                    |
    |                      |                    |-- read(slug) ----->|                    |
    |                      |                    |-- format summary   |                    |
    |                      |<-- {text: "..."} --|                    |                    |
    |                      |                    |                    |                    |
    |<-- result ----------|                    |                    |                    |
```

Notes:
- `app_invoke` is a single MCP tool that multiplexes across all apps and hooks
- The `describe` hook generates a summary from the data structure — not a full LLM call, just a formatted text rendering of keys and values
- Write hook replaces the entire data.json contents (caller is responsible for merge if needed)
- Tool returns standard MCP content format: `{content: [{type: "text", text: ...}]}`
