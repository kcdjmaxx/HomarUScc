# Config

**Language:** TypeScript
**Environment:** Node.js >= 22, dotenv

The config system loads, resolves, and hot-reloads configuration.

## Resolution Order

1. Path from `HOMARUSCC_CONFIG` env var
2. `homaruscc.json` in current working directory
3. `~/.homaruscc/config.json` (fallback)

## Environment Variable Substitution

String values containing `${VAR_NAME}` are replaced with the corresponding environment variable. This works recursively in objects and arrays, allowing secrets to live in `.env` files rather than config JSON.

## .env Support

If a `.env` file exists in the same directory as the config file, it's loaded via dotenv before variable resolution.

## Hot-Reload

- Config file is watched every 2 seconds
- Changes are classified as safe (memory.search, skills.paths, timers.enabled, dashboard.enabled) or unsafe
- Safe changes are applied immediately; unsafe changes trigger a restart warning
- Parse errors during reload are logged and the old config is retained

## Config Sections

channels, memory, skills, dashboard, timers, identity, browser, toolPolicies
