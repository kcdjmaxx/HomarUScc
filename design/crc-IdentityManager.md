# IdentityManager
**Requirements:** R53, R54, R55, R56, R57, R149

## Knows
- soulContent: loaded soul.md text
- userContent: loaded user.md text
- overlays: map of overlay name → content
- workspaceFiles: map of filename → content
- identityDir: path to identity directory
- workspaceDir: path to workspace directory

## Does
- load: read soul.md, user.md, state.md, overlays/, workspace files
- reload: clear and re-load all identity files
- buildSystemPrompt: assemble parts (soul, user, state, overlays, workspace, task) joined with ---
- getSoul / getUser / getAgentState / getOverlay / getWorkspaceFile: accessors
- getDigest: return compressed identity (~200 tokens) — name, Vibe section, last session mood (R149)
- listOverlays: return overlay names

## Collaborators
- HomarUScc: loads identity on startup
- McpResources: exposes soul/user as MCP resources

## Sequences
- seq-startup.md
