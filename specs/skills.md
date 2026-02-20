# Skills

**Language:** TypeScript
**Environment:** Node.js >= 22

The skill system provides hot-loadable plugin extensibility.

## Skill Structure

Each skill is a directory containing a `skill.json` manifest with:
- Name, version, description
- Event types it emits and handles
- Tool definitions it provides
- Optional process configuration (command, args, port, healthCheck)

## Transports

Three communication modes:
- **HTTP:** Skill runs as a web server; events sent via POST to callbackUrl
- **Stdio:** Skill runs as a subprocess; JSON lines over stdin/stdout
- **Direct:** In-process function call for embedded or testing scenarios

## Lifecycle

- SkillManager scans configured search paths for skill directories
- Each skill is loaded: manifest parsed, transport created, process spawned
- Skills register their tools in the ToolRegistry
- Skills register event handlers in the EventBus for their `handles` event types
- Skills can emit events back to the loop via their transport
- Hot-reload: file watcher detects skill.json changes and reloads the skill

## State Machine

loaded → starting → running → stopping → stopped (or error at any point)
