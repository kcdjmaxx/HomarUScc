# Skill
**Requirements:** R58, R60, R63

## Knows
- manifest: parsed skill.json
- transport: SkillTransport instance
- state: loaded | starting | running | stopping | stopped | error
- loopEmitter: callback to emit events back to the loop

## Does
- start: spawn process via transport, transition to running
- stop: shut down transport, transition to stopped
- getState: return current state
- getTools: return manifest tool definitions
- getHandledEvents: return manifest handles list
- getEmittedEvents: return manifest emits list
- receiveFromLoop: forward event to skill via transport
- onLoopEvent: register handler for events emitted by skill
- health: check transport health

## Collaborators
- SkillTransport: communication layer
- SkillManager: lifecycle management

## Sequences
- seq-startup.md
