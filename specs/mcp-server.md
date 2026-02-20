# MCP Server

**Language:** TypeScript
**Environment:** Node.js >= 22, @modelcontextprotocol/sdk

HomarUScc exposes itself to Claude Code as an MCP server over stdio transport.

## Tools

The server registers 18 MCP tools that Claude Code can call:

- **Telegram:** send messages, read recent incoming messages
- **Memory:** hybrid vector+FTS search, store and index content
- **Timers:** schedule (cron/interval/once) and cancel timers
- **Dashboard:** send messages to the web dashboard chat
- **System:** get status, get event history, long-poll for events
- **Browser:** navigate, snapshot (accessibility tree), screenshot, click, type, evaluate JS, get page content
- **Universal:** run any registered tool by name (bash, read, write, edit, glob, grep, git, web)

## Resources

Four read-only resources are exposed:

- `identity://soul` — the soul.md content
- `identity://user` — the user.md content
- `config://current` — full config with secrets redacted (tokens replaced with ***)
- `events://recent` — last 20 events

## Lifecycle

The MCP server starts the HomarUScc loop, creates the stdio transport, and wires up ListTools, CallTool, ListResources, and ReadResource handlers. Events from the loop trigger MCP server notifications to Claude Code.
