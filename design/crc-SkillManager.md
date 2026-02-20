# SkillManager
**Requirements:** R58, R59, R60, R61, R62

## Knows
- skills: map of skill name → Skill instance
- searchPaths: directories to scan for skills
- eventBus: for registering skill event handlers
- toolRegistry: for registering skill tools
- watcher: file watcher for hot-reload

## Does
- loadAll: scan search paths, load each skill directory
- load: parse skill.json, create transport, create Skill instance, start
- unload: stop skill, remove handlers and tools
- reload: unload then load
- get / getAll: skill lookup
- getTools: aggregate tools from all skills
- startWatching: watch skill.json files for changes
- stopWatching: remove file watchers
- stopAll: stop all skills

## Collaborators
- Skill: individual skill lifecycle
- SkillTransport: communication with skill process
- EventBus: register handled event types
- ToolRegistry: register skill tools

## Sequences
- seq-startup.md
