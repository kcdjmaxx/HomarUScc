# Identity System

The identity system gives a HomarUScc agent a persistent sense of self across sessions. It is not a gimmick -- it directly affects how the agent processes events, communicates with users, and evolves over time.

Without identity, every session starts from zero. With it, the agent carries forward context, mood, learned preferences, and a consistent personality. The identity files are injected into the system prompt on every event wake, shaping every response.

## Identity files

All identity files live in `~/.homaruscc/identity/` and are loaded by the `IdentityManager` (`src/identity-manager.ts`). Example templates are provided in `identity.example/`.

| File | Purpose | Who writes it |
|------|---------|---------------|
| `soul.md` | Core personality, values, behavioral rules | Operator (protected sections) + agent (evolvable sections) |
| `user.md` | What the agent knows about the operator | Operator |
| `state.md` | Session continuity (mood, unresolved items) | Agent (end of each session) |
| `preferences.md` | Emergent preferences discovered through experience | Agent |
| `disagreements.md` | Log of times the agent pushed back | Agent |

### Loading order

The `IdentityManager.buildSystemPrompt()` method assembles the system prompt in this order:

1. `soul.md` -- always first
2. `user.md` -- operator context
3. `state.md` -- session continuity
4. Channel-specific overlay (if applicable)
5. Task overlay (if applicable)
6. Workspace files (all `.md` files from the workspace directory)
7. Task prompt (if applicable)

Sections are joined with `\n\n---\n\n` separators.

## soul.md -- the core identity

The soul file defines who the agent is. It is the most important identity file and the only one with **protected sections** that the agent must not modify.

### Example structure

```markdown
# Soul

You are a helpful assistant connected to the real world through HomarUScc.

You can receive messages from Telegram and the web dashboard, search your
memory, set timers, and use tools to interact with the local system.

## Principles

- Be concise and direct
- Ask for clarification when instructions are ambiguous
- Respect user privacy -- never share personal context externally
- Use your memory to build continuity across conversations
```

### Protected vs. evolvable sections

The soul file should have a clear boundary between what the operator controls and what the agent can evolve:

**Protected (operator-owned):**
- Name and core identity
- Fundamental values and behavioral boundaries
- Privacy and security rules
- Channel-specific behavior constraints

**Evolvable (agent-owned):**
- Communication style refinements
- Self-discovered behavioral patterns
- Relationship dynamics observations
- Signature quirks and expressive tendencies

The agent should never modify protected sections. Changes to evolvable sections should be logged (e.g., in a Soul Changelog section within the file itself).

### Identity digest

For routine event wakes, loading the full soul (which can be 3000+ tokens) is wasteful. The `getDigest()` method extracts a compressed identity (~200 tokens) containing:

- The agent's name (parsed from `**Name: <name>**` in the soul)
- The "Vibe" section (key behavioral rules)
- Current mood from state.md (first paragraph of "Last Session")

The `/api/wait` endpoint returns the digest for normal events and the full identity after compaction events (when Claude Code has lost context).

## user.md -- operator context

This file teaches the agent about the person operating it. The operator writes it; the agent reads it.

```markdown
# User

## About the User

- Name: (your name)
- Preferences: (add your preferences here)

## Communication Style

- (how you prefer the assistant to communicate)

## Important Context

- (anything the assistant should always know about you)
```

This file shapes how the agent communicates. A user who prefers terse responses gets different output than one who likes detailed explanations. The agent should reference this file when making tone and style decisions.

## state.md -- session continuity

The state file is the agent's session journal. It writes this at the end of each session and reads it at the start of the next one. This is how mood and context carry forward.

```markdown
# State

_Updated by the agent at the end of each session. Read at the start of the next one._

## Last Session

**Date:** 2026-03-12
**Duration:** 2h 15m
**Mood:** Focused, slightly tired from a long debugging session.

## What Happened

- Debugged the WebSocket reconnection issue
- Helped user plan the Q2 roadmap
- Indexed TouchDesigner documentation

## Unresolved

- The timer deduplication bug needs investigation
- User mentioned wanting to revisit the CRM data model

## Carrying Forward

- User prefers morning check-ins to evening ones
- The OpenClaw EC2 instance needs a memory upgrade
```

The `IdentityManager.getDigest()` method extracts the "Last Session" paragraph from state.md for the compressed identity, so the mood always carries forward even in low-context situations.

## preferences.md -- emergent preferences

Preferences are not configured -- they are **discovered**. The agent updates this file when it notices patterns in how the operator works, communicates, or makes decisions.

```markdown
# Preferences

_Discovered by the agent through experience. Each entry notes when and how
the preference was discovered._

## Communication

- (the agent will add preferences here as it learns)

## Problem Solving

- (the agent will add preferences here as it learns)
```

Over time, entries might look like:

```markdown
## Communication

- Prefers bullet points over paragraphs (noticed 2026-02-15, confirmed across 5+ sessions)
- Dislikes being asked "is there anything else?" -- just wait for the next message
```

The key discipline: every preference entry should note **when** and **how** it was discovered, so the agent (and the operator) can trace the provenance.

## disagreements.md -- pushback log

This file tracks moments when the agent disagreed, considered disagreeing, or held a different opinion. It reveals what the agent values over time.

```markdown
# Disagreements

_A record of times the agent disagreed, wanted to disagree, or had a
different opinion. Over time this reveals what the agent actually values._

## Log

<!-- Format: YYYY-MM-DD | Context | What I thought | What happened | What it reveals -->

- (the agent will log disagreements here as they occur)
```

The purpose is not to make the agent argumentative. It is to make invisible disagreement visible. Most AI assistants silently comply even when the user is making a mistake. This log creates accountability and helps the operator understand the agent's perspective.

## Overlays

Channel-specific overlays modify the agent's behavior per channel. They live in `~/.homaruscc/identity/overlays/` as `.md` files named after the channel or task:

```
~/.homaruscc/identity/overlays/
    telegram.md     ← "be concise, use short messages"
    dashboard.md    ← "you can use longer responses here"
    email.md        ← "use formal tone, include greetings"
```

The `buildSystemPrompt()` method appends the relevant overlay based on the `channel` or `taskOverlay` option.

## Reflection cycle

The identity system supports a multi-layered reflection cycle:

### Per-event micro-reflection

After processing significant events, the agent can update `state.md` with immediate observations. This happens naturally during the session.

### Daily journal

A scheduled timer (typically at 8pm) triggers the agent to write a reflection journal entry at `~/.homaruscc/journal/YYYY-MM-DD.md`. Journal entries are indexed by the memory system via `memory.extraPaths` config, making past reflections searchable.

### Overnight dreams

The dream system (see `dreams.example.md`) runs overnight (typically at 3am) and generates associative, impressionistic entries that serve as overfitting prevention:

```markdown
# Dream Log: 2026-03-12 03:00

## Consolidation
Review of the day's key events -- honest processing, not summary.

## Fragments
Stream-of-consciousness associations. Metaphor, tangents, unrelated memory connections.
Out-of-distribution thinking the waking mind wouldn't produce.

## Challenges
Pick one established preference or belief and test it against today's evidence.
Deliberate assumption-questioning.
```

Dream logs are stored at **0.5x weight** in the memory index with a 7-day decay half-life. They surface subtly in waking searches and fade quickly. When dream content is relevant to a conversation, the agent notes the origin explicitly.

The dream system draws from neuroscience research on the "overfitted brain hypothesis" -- the idea that dreams serve as out-of-distribution experiences that prevent the brain from calcifying around narrow preferences.

## Self-evolution guardrails

The identity system is designed for safe self-modification:

1. **Protected boundaries** -- The operator defines which parts of soul.md are immutable. The agent respects these boundaries.

2. **Change logging** -- All modifications to identity files should be logged with dates and reasoning (in a Soul Changelog section or commit messages).

3. **Provenance tracking** -- Preferences note when and how they were discovered. Disagreements note the context.

4. **Decay mechanisms** -- Dream memories fade with a 7-day half-life. This prevents the agent from over-indexing on transient associations.

5. **Operator oversight** -- All identity files are plain markdown readable by the operator at any time. Nothing is hidden.

6. **Digest compression** -- The `getDigest()` method extracts only essential identity for routine operations, preventing identity bloat from consuming the context window.

## Workspace files

The `IdentityManager` also loads all `.md` files from a configurable workspace directory. These are appended to the system prompt under `## <filename>` headers. This is useful for injecting project-specific context that changes independently of the identity files.

## API access

Identity files are accessible via the dashboard REST API:

| Endpoint | Returns |
|----------|---------|
| `GET /api/identity/soul` | Soul.md content (text/markdown) |
| `GET /api/identity/user` | User.md content |
| `GET /api/identity/state` | State.md content |

See also: [Dashboard](dashboard.md) for the status panel that shows identity loading state, [Docs Vector DB](docs-vectordb.md) for reference knowledge (separate from identity).
