# ToolRegistry
**Requirements:** R64, R65, R66, R67, R68

## Knows
- tools: map of tool name → ToolDefinition
- groups: map of group name → tool names
- policies: array of ToolPolicyConfig

## Does
- register: add tool definition
- unregister: remove tool by name
- get / getAll: tool lookup
- execute: look up tool, check policy, validate params, call execute, return result
- registerGroup: define a named group of tools
- resolveGroup: expand group name to individual tool names
- addPolicy: add allow/deny policy
- checkPolicy: validate tool name against policies
- getForAgent: filter tools by allowed list, resolving groups
- toSchemas: export tool definitions for MCP ListTools

## Collaborators
- HomarUScc: registers built-in tools on startup
- SkillManager: registers skill tools
- McpTools: run_tool dispatches through registry

## Sequences
- seq-event-flow.md
