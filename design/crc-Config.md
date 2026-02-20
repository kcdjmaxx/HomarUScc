# Config
**Requirements:** R69, R70, R71, R72, R73, R74

## Knows
- data: current ConfigData
- configPath: resolved path to config file
- watching: whether file watcher is active

## Does
- load: read JSON, resolve env vars, merge with defaults
- get: dot-path accessor (e.g., "memory.embedding.provider")
- getSection: top-level section accessor
- getAll: return full ConfigData
- startWatching: poll file every 2s, classify safe/unsafe changes
- stopWatching: remove file watcher
- resolveEnvVars: replace ${VAR} patterns recursively
- loadEnvFile: load .env from config directory

## Collaborators
- HomarUScc: consumes config at startup and on reload

## Sequences
- seq-startup.md
