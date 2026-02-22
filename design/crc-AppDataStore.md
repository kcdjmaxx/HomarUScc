# AppDataStore
**Requirements:** R191, R192, R193, R194, R195, R196, R209, R189, R190

## Knows
- appsDir: string — root directory for apps (same as AppRegistry)

## Does
- read(slug): read and parse `~/.homaruscc/apps/{slug}/data.json`, return parsed JSON object; return empty object if file does not exist (R191, R194)
- write(slug, data): write JSON payload to `~/.homaruscc/apps/{slug}/data.json`; create file if it does not exist (R192, R194, R195)
- describe(slug, manifest): read data, generate a natural language summary based on the manifest description and data keys/values (R193); returns a text string
- invoke(slug, hook, params): dispatch to read/write/describe based on hook name; return error result if app or hook not found (R196, R209)

## Collaborators
- AppRegistry: resolves slug to manifest, validates hook existence
- MCP tool (app_invoke): calls invoke() with slug, hook, params

## Sequences
- seq-apps-invoke.md
