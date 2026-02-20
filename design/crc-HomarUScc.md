# HomarUScc
**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8, R9
**Refs:** ref-mcp-spec

## Knows
- state: current lifecycle state (starting, running, stopping, stopped)
- eventHistory: rolling buffer of last 100 events
- eventWaiters: set of blocked long-poll resolvers
- notifyFn: MCP notification callback

## Does
- start: initialize all subsystems in order, begin event processing
- stop: drain queue, resolve waiters, shut down all subsystems
- emit: enqueue event, store in history, signal waiters
- waitForEvent: block caller until events arrive or timeout
- processEvent: route event through EventBus, forward to MCP if unhandled
- getStatus: aggregate health from all subsystems
- registerHandler: add direct event handler to EventBus

## Collaborators
- Config: load and watch configuration
- EventBus: route events to handlers
- EventQueue: priority-based event buffering
- ChannelManager: channel lifecycle and messaging
- MemoryIndex: persistent search index
- IdentityManager: soul/user/overlay loading
- TimerService: scheduled event firing
- BrowserService: browser automation (optional)
- ToolRegistry: tool execution
- SkillManager: plugin lifecycle

## Sequences
- seq-startup.md
- seq-event-flow.md
- seq-shutdown.md
