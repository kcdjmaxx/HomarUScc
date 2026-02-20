# SkillTransport
**Requirements:** R59

## Knows
- type: http | stdio | direct

## Does
- start: establish connection (abstract)
- stop: close connection (abstract)
- send: deliver event to skill (abstract)
- onEvent: register handler for events from skill (abstract)
- health: check connection status (abstract)

### HttpSkillTransport
- POSTs events to callbackUrl
- No process management

### StdioSkillTransport
- JSON lines over stdin/stdout
- Spawns child process
- Line-buffered parsing

### DirectSkillTransport
- In-process function call
- No network, no subprocess

## Collaborators
- Skill: uses transport for communication

## Sequences
- seq-startup.md
