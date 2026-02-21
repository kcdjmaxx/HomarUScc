# AgentDispatchPrompt
**Requirements:** R133, R134, R135, R142, R143, R144, R145, R148
**Refs:** ref-claude-code-task-tool

## Knows
- dispatchHeuristics: rules for inline vs dispatch decisions
- agentContext: what context to provide spawned agents
- resultRouting: how agent results flow back to the user

## Does
- evaluateDispatch(event): decision — Determines if event should be handled inline or dispatched to a background agent
- buildAgentPrompt(task, memories): string — Constructs the prompt for a spawned agent with relevant context
- handleAgentResult(result): void — Processes agent completion, summarizes, sends to user via Telegram/dashboard

## Collaborators
- AgentRegistry: checks available slots before dispatching
- Skill prompt: this is implemented as instructions in the skill file, not TypeScript

## Sequences
- seq-agent-dispatch.md

## Notes
This is a "prompt CRC" — the behavior lives in the Claude Code skill prompt, not in TypeScript code. The CRC documents the design contract that the prompt must fulfill.
