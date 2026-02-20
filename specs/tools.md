# Tools

**Language:** TypeScript
**Environment:** Node.js >= 22

The tool registry manages all executable tools available to the system.

## Built-in Tool Groups

- **group:fs** — read, write, edit, glob, grep (file system operations)
- **group:runtime** — bash (with safety blocklist), git
- **group:web** — web_fetch, web_search
- **group:memory** — memory_search, memory_get, memory_store
- **group:browser** — all browser_* tools (registered by BrowserService)

## Bash Safety

The bash tool blocks dangerous patterns: rm -rf, sudo, mkfs, dd, chmod 777, curl|bash, system control commands, and fork bombs. Output is truncated to 50k characters.

## Tool Policies

Config-driven allow/deny lists that can reference individual tools or groups. Policies are checked before execution.

## Execution Flow

1. Look up tool by name
2. Check policies (allow/deny)
3. Validate params (must be object)
4. Call tool.execute(params, context)
5. Return {output, error?}

## MCP Integration

The `run_tool` MCP tool acts as a universal dispatcher — Claude Code can call any registered tool by name through it. Tools are also exposed directly as MCP tools where appropriate (memory, timer, browser, etc.).
