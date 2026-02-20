# EventBus
**Requirements:** R3, R4

## Knows
- directHandlers: map of event type → handler functions
- agentHandlers: map of event type → agent handler configs

## Does
- registerDirect: add a synchronous handler for an event type
- registerAgent: add an agent-type handler (triggers MCP notification in HomarUScc)
- getHandlers: return {direct, agent} handlers for an event type
- unregister: remove a handler by type and id

## Collaborators
- HomarUScc: receives events to route

## Sequences
- seq-event-flow.md
