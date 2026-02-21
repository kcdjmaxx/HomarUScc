# ClaudeCodeRegistrar
**Requirements:** R176

## Knows
- settingsLocations: candidate paths for Claude Code settings (`~/.claude.json`, `~/.claude/settings.json`)
- mcpServerConfig: the JSON block to register HomarUScc as an MCP server

## Does
- detectSettingsFile(): check candidate paths, return first that exists (or null)
- promptRegister(): ask user if they want to auto-register HomarUScc in Claude Code settings
- register(settingsPath): read settings JSON, add HomarUScc MCP server entry, write back
- buildMcpEntry(): construct the mcpServers entry with command pointing to `npx homaruscc` or the resolved binary path

## Collaborators
- fs (Node.js built-in): read/write settings file
- Wizard: called by wizard after scaffolding

## Sequences
- seq-first-run.md
