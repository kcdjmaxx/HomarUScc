# Sequence: Normal Start (Config Exists)

**Requirements:** R163, R164, R165

## Trigger
User runs `npx homaruscc` with existing `~/.homaruscc/config.json`.

## Participants
- Cli
- McpProxy (existing mcp-proxy.ts)

## Flow

```
Cli                    McpProxy
 |                      |
 |--resolveConfigPath-->|
 |  (found)             |
 |                      |
 |--import('../mcp-proxy.js')
 |  (re-exports main)   |
 |                      |
 |  [proxy starts       |
 |   normally via       |
 |   existing main()]   |
 |                      |
```

## Notes

The Cli module does not re-implement proxy startup logic. It dynamically imports
the existing `mcp-proxy.js` module which contains its own `main()` function.
This avoids duplicating the BackendManager, MCP server setup, and WebSocket relay.
