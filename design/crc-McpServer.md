# McpServer
**Requirements:** R10, R11, R12, R13, R14
**Refs:** ref-mcp-spec

## Knows
- server: MCP Server instance
- transport: stdio transport
- loop: HomarUScc event loop reference
- tools: array of McpToolDef
- resources: array of McpResourceDef

## Does
- main: entry point — create logger, loop, MCP server, wire handlers, connect transport
- handleListTools: return all registered MCP tool schemas
- handleCallTool: dispatch tool call to appropriate handler
- handleListResources: return available resource URIs
- handleReadResource: return resource content (identity, config, events)
- redactConfig: mask tokens/secrets in config before exposure
- onNotify: forward event loop notifications to MCP server notifications

## Collaborators
- HomarUScc: event loop lifecycle
- McpTools: tool definitions and handlers
- McpResources: resource definitions and readers

## Sequences
- seq-startup.md
- seq-event-flow.md
