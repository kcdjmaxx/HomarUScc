# Cli
**Requirements:** R163, R164, R165, R166

## Knows
- configPath: resolved path to `~/.homaruscc/config.json`
- proxyScript: resolved path to `dist/mcp-proxy.js`

## Does
- main(): check if config exists; if yes, spawn proxy via execSync/spawn; if no, import and run Wizard
- resolveConfigPath(): return `$HOME/.homaruscc/config.json`

## Collaborators
- Wizard: imported dynamically only when no config exists
- McpProxy: spawned as child process when config exists (delegates to existing `dist/mcp-proxy.js`)

## Sequences
- seq-first-run.md
- seq-normal-start.md
