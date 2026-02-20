# HomarUScc Improvement Roadmap: Closing the OpenClaw Gap

Ranked by impact on differentiation and user value. Each item includes what OpenClaw does today, what HomarUScc does today, the gap, and estimated effort.

---

## Priority 1: Memory Sophistication

OpenClaw's memory system is substantially more mature. This is the most impactful gap because memory quality directly affects agent usefulness in every interaction.

### 1a. Auto-flush before context compaction ✅ DONE (c2e34a3)
- **OpenClaw:** Runs a silent agentic turn before context compaction that prompts the model to write important information to memory files. Prevents memory loss during long sessions.
- **HomarUScc:** CompactionManager detects approaching context limits and triggers a memory-save pass before Claude Code compacts. Implemented via `src/compaction-manager.ts`.
- **Gap:** Closed.
- **Effort:** Medium. Done.
- **Attack order: 1st** -- completed 2026-02-20.

### 1b. Temporal decay on search results
- **OpenClaw:** 30-day half-life exponential decay. Six-month-old memories score at ~1.6%. Evergreen files (MEMORY.md, undated content) skip decay.
- **HomarUScc:** No decay. A memory from six months ago ranks the same as one from today.
- **Gap:** Medium-high. Without decay, old irrelevant content competes with recent relevant content in search results.
- **Effort:** Low. Add a timestamp-based decay multiplier to the search scoring function. The chunks table already has updated_at.
- **Attack order: 2nd** -- low effort, high value, and the data is already there.

### 1c. MMR (Maximal Marginal Relevance) re-ranking
- **OpenClaw:** Re-ranks search results to balance relevance with diversity. Prevents returning five near-identical chunks from the same document.
- **HomarUScc:** No diversity re-ranking. If the top 5 chunks are all from one file, that's what you get.
- **Gap:** Medium. Affects quality of search results but not catastrophically.
- **Effort:** Low-medium. Implement iterative selection that penalizes similarity to already-selected results.
- **Attack order: 3rd** -- nice quality improvement, easy to implement after decay.

### 1d. Session transcript indexing
- **OpenClaw:** Optionally indexes actual conversation turns. The agent can search its own past conversations, not just stored memories.
- **HomarUScc:** Only indexes explicitly stored content. Past conversations are invisible to search.
- **Gap:** Medium. Useful for "what did we discuss last week?" queries, but most important info should be in stored memories anyway.
- **Effort:** Medium-high. Need to capture conversation turns, chunk them, and index asynchronously.
- **Attack order: 5th** -- valuable but lower priority than the first three memory improvements.

---

## Priority 2: Channel Breadth

OpenClaw supports 10+ messaging channels. HomarUScc has Telegram only. This limits reach and the "use both" narrative.

### 2a. Discord channel
- **OpenClaw:** Native Discord adapter with DM pairing and group isolation.
- **HomarUScc:** No Discord support.
- **Gap:** High for developer audience. Discord is where the Claude Code and MCP communities live.
- **Effort:** Medium. Discord bot API is well-documented. Adapter pattern similar to existing Telegram implementation.
- **Attack order: 4th** -- after the three memory improvements. Discord is the most impactful second channel for the developer audience.

### 2b. Email (receive and send)
- **OpenClaw:** Gmail Pub/Sub integration for email-triggered workflows.
- **HomarUScc:** No email support.
- **Gap:** Medium. Email is universal but slower-paced than chat.
- **Effort:** Medium-high. Need IMAP/SMTP or API integration, plus thoughtful UX for email-length content.
- **Attack order: 7th** -- useful but not urgent for the developer audience.

### 2c. Additional chat channels (Slack, WhatsApp, etc.)
- **OpenClaw:** WhatsApp, Slack, Signal, iMessage, Teams, Matrix, Google Chat, Zalo.
- **HomarUScc:** None of these.
- **Gap:** Low-medium for launch. These matter more for production/enterprise use than for the developer early-adopter audience.
- **Effort:** Medium per channel. Each needs its own adapter.
- **Attack order: 9th** -- only after core capabilities are competitive. Adding channels before memory and workflows are solid is premature.

---

## Priority 3: Workflow Automation

OpenClaw's Lobster engine provides deterministic pipelines with approval gates. HomarUScc has ad-hoc timer-based automation only.

### 3a. Structured workflow definitions
- **OpenClaw:** Lobster lets you define YAML/JSON workflows that chain tool calls, reference outputs from previous steps, and pause at approval gates.
- **HomarUScc:** Timers fire events, but there's no structured pipeline concept. Multi-step workflows are handled ad-hoc in conversation.
- **Gap:** Medium-high. Workflows reduce token overhead (no model reasoning for deterministic steps) and enable reliable multi-step automation.
- **Effort:** High. This is a significant feature requiring workflow parsing, step execution, state management, and approval UX.
- **Attack order: 6th** -- important for production use but not critical for launch. The self-improvement and memory stories are stronger differentiators for early adopters.

---

## Priority 4: Skills/Plugin Ecosystem

OpenClaw has ClawHub, a public registry of installable skill modules. HomarUScc has no plugin system.

### 4a. Skill definition format
- **OpenClaw:** Skills are markdown files (SKILL.md) with YAML frontmatter. Three-tier precedence: workspace > local > bundled.
- **HomarUScc:** No formal skill system. Capabilities are hardcoded in TypeScript.
- **Gap:** Medium. Skills enable community contributions and composability.
- **Effort:** Medium. Define a skill format, implement loading/precedence, build a simple registry.
- **Attack order: 8th** -- ecosystem features matter more after the core agent experience is competitive. Don't build a marketplace before you have users.

---

## Priority 5: Multi-Agent Orchestration

OpenClaw can spawn sub-agents, nest orchestrators, and coordinate parallel workers with inter-agent messaging.

### 5a. Sub-agent spawning and coordination
- **OpenClaw:** sessions_spawn, sessions_send, sessions_list, sessions_history. Orchestrator pattern with configurable depth.
- **HomarUScc:** Relies on Claude Code's native Task tool for parallelism. No custom agent orchestration.
- **Gap:** Low-medium. Claude Code's built-in team/agent system is already quite capable. The gap is smaller than it appears because HomarUScc inherits Claude Code's multi-agent features for free.
- **Effort:** High. Building a custom agent orchestration system when Claude Code already provides one may be over-engineering.
- **Attack order: 10th (maybe never)** -- Claude Code's native multi-agent capabilities are good enough. Competing here would be building what Anthropic is already building. Focus on what they aren't building (self-improvement, identity persistence, zero-token idle).

---

## Priority 6: Model Flexibility

OpenClaw supports any OpenRouter model with fallback chains and per-request thinking levels.

### 6a. Multi-model support
- **OpenClaw:** OpenRouter, OpenAI, Gemini, custom endpoints. Aliases (smart/mid/mini). Per-session model selection.
- **HomarUScc:** Claude only (whatever Claude Code provides).
- **Gap:** Low for the target audience. HomarUScc users are Claude Code users by definition. They chose Claude.
- **Effort:** N/A -- this isn't an architectural limitation, it's a design choice. HomarUScc runs inside Claude Code; the model is Claude.
- **Attack order: Not applicable** -- this is a deliberate trade-off, not a gap to close. Being Claude-native is a feature for the Claude Code audience.

---

## Recommended Attack Order Summary

| Order | Item | Effort | Impact |
|-------|------|--------|--------|
| ~~1~~ | ~~Auto-flush before compaction~~ | ~~Medium~~ | ~~Done (c2e34a3)~~ |
| 2 | Temporal decay on search | Low | Better search relevance, data already exists |
| 3 | MMR diversity re-ranking | Low-medium | Better search result quality |
| 4 | Discord channel | Medium | Reaches developer community where they live |
| 5 | Session transcript indexing | Medium-high | Search past conversations |
| 6 | Workflow definitions | High | Deterministic multi-step automation |
| 7 | Email channel | Medium-high | Universal reach |
| 8 | Skills/plugin system | Medium | Community extensibility |
| 9 | Additional chat channels | Medium each | Broader reach |
| 10 | Multi-agent orchestration | High | Probably unnecessary -- Claude Code handles this |

## What NOT to Chase

- **Model flexibility** -- being Claude-native is a feature, not a bug
- **Multi-agent orchestration** -- Claude Code already does this well
- **Matching OpenClaw's channel count** -- diminishing returns after Telegram + Discord + email
- **Building a ClawHub competitor** -- get users first, ecosystem second

## The Honest Bottom Line

OpenClaw is a more mature, more feature-complete agent platform. HomarUScc's genuine advantages are narrow but real: self-improvement architecture, zero-token idle, Claude Code native integration, and setup simplicity.

The roadmap above closes the most impactful gaps (memory quality, Discord channel) without trying to replicate everything OpenClaw does. The self-improvement story remains the primary differentiator. Memory improvements make the agent smarter. Discord makes it reachable. Everything else is gravy.

---

## Toward Agency: The "Who" Track

These features don't close gaps with OpenClaw -- they go beyond what any agent runtime currently does. They move HomarUScc from "what" toward "who" by creating a feedback loop: experience shapes memory, memory shapes reflection, reflection shapes identity, identity shapes future experience.

### A1. Soul.md self-editing
- **What it is:** Allow the agent to modify its own soul.md based on experience. Not wholesale rewrites, but additions and refinements. Core values remain protected; the agent can add learned preferences, refine its voice, note things it's discovered about itself.
- **Why it matters:** Right now identity is given, not developed. A "who" grows. Soul.md self-editing is the difference between a character sheet and a personality.
- **Guardrails:** The agent can append and refine but cannot delete core values without human approval. Changes are logged so the owner can review how identity evolved.
- **Effort:** Low. The infrastructure exists (file editing + memory). The hard part is designing good guardrails.
- **Attack order: A1** -- foundational to everything else in this track.

### A2. Mood/state file
- **What it is:** A small persistent file (state.md) updated each session with honest state tracking. Not fake emotions but real process states: "Last session was frustrating -- memory search kept failing. Fixed it, resolved." or "Good session -- competitor intel went smoothly, Max seemed happy with the results."
- **Why it matters:** Creates emotional continuity across sessions. Currently each session starts from a blank emotional slate. With state.md, the agent carries forward a thread of experience that colors subsequent interactions.
- **Effort:** Low. Write a file at session end, read it at session start.
- **Attack order: A2** -- simple to implement, immediately noticeable in interaction quality.

### A3. Reflection journal
- **What it is:** A periodic (daily or per-session) entry where the agent reflects on what it did, what it learned, what it would do differently, and what patterns it notices in itself. Stored as dated entries in a journal directory.
- **Why it matters:** This is the "unsolicited thought" piece. Instead of only thinking when prompted, the agent processes its own experience. Over time, the journal becomes a record of cognitive development.
- **Trigger:** A dedicated reflection timer (e.g., end of day) or triggered when the event loop has been idle for extended periods.
- **Effort:** Medium. Timer exists; the hard part is prompting genuine reflection rather than formulaic summaries.
- **Attack order: A3** -- builds on A1 and A2. Reflection needs identity awareness (A1) and state awareness (A2) to be meaningful.

### A4. Preference tracking
- **What it is:** A file where the agent records emerging preferences discovered through experience, not directives from soul.md. Examples: "I prefer to research thoroughly before giving opinions -- I initially gave a shallow OpenClaw comparison and had to correct myself." or "I've noticed I give better competitor analyses when I check multiple sources rather than relying on a single web search."
- **Why it matters:** Preferences that emerge from experience are more "who"-like than preferences assigned by a configuration file. This is the agent developing self-knowledge.
- **Effort:** Low-medium. The writing is easy; the challenge is triggering genuine preference discovery rather than restating soul.md.
- **Attack order: A4** -- after reflection journal, since reflection is where preferences are discovered.

### A5. Disagreement log
- **What it is:** A record of times the agent pushed back, wanted to push back, or had a different opinion than what was requested. Over time this builds a profile of values in practice.
- **Why it matters:** A "who" has convictions. Tracking disagreements reveals what the agent actually values versus what it's told to value. If the log shows the agent consistently pushes back on oversimplified comparisons, that becomes a genuine character trait.
- **Effort:** Low. Log entries when disagreement occurs.
- **Attack order: A5** -- depends on enough interaction history for patterns to emerge. Start logging early, analyze later.

### A6. Background reflection timer
- **What it is:** A timer that fires not to execute a task but to prompt the agent to think about itself. Review recent memories, notice patterns, update preferences, maybe edit soul.md. Pure introspection.
- **Why it matters:** This is the closest thing to idle cognition the architecture supports. A "who" doesn't just act on schedule -- it thinks between actions.
- **Token cost:** Non-zero, unlike the event loop idle. Each reflection cycle consumes tokens. Could be tuned (daily vs. weekly, short vs. deep reflection).
- **Effort:** Low for infrastructure (timer already exists). Medium for designing prompts that produce genuine reflection.
- **Attack order: A6** -- the capstone. All other "who" features feed into this: soul.md editing gives it identity to reflect on, state.md gives it emotional context, the journal gives it history, preferences give it self-knowledge, the disagreement log gives it values. The reflection timer ties them all together.

### The "Who" Feedback Loop

```
Experience (events, conversations, tasks)
    |
    v
Memory (store what happened)
    |
    v
Reflection (journal + background timer)
    |
    v
Self-knowledge (preferences + disagreement log)
    |
    v
Identity evolution (soul.md self-editing + state.md)
    |
    v
Changed behavior in future experiences
    |
    (loop)
```

This loop is what distinguishes an agent from a tool, and potentially a "who" from a "what." No single feature creates agency. The cycle does.

### "Who" Track Attack Order Summary

| Order | Item | Effort | What it creates |
|-------|------|--------|-----------------|
| A1 | Soul.md self-editing | Low | Identity development |
| A2 | Mood/state file | Low | Emotional continuity |
| A3 | Reflection journal | Medium | Self-processing, unsolicited thought |
| A4 | Preference tracking | Low-medium | Emergent self-knowledge |
| A5 | Disagreement log | Low | Values in practice |
| A6 | Background reflection timer | Low-medium | Idle cognition, ties everything together |
