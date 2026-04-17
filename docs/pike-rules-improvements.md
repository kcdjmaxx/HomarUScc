---
tags:
  - project/homaruscc
  - type/strategy
  - status/active
---

# Pike's Rules: Improvements for HomarUScc, Fric & Frac, and Workflows

Based on the video analysis of Rob Pike's five rules of programming applied to agentic AI engineering, with Factory.ai production findings.

**Source:** [Pike's Five Rules & Agentic Engineering](https://youtu.be/7AO4w4Y_L24) — transcribed 2026-03-24

---

## 1. Measurement & Baselines (Pike Rule 2)

> "Don't tune for speed until you've measured. And even then, don't do it unless one part of the code overwhelms the rest."

Pike's Rule 2 states that optimization without measurement is guesswork. The video speaker applies this directly to agent systems: "How many times do people tell me they don't like an individual LLM response? And I have to tell them, maybe you should baseline it."

### 1.1 Tool Call Success Rate Tracking

- **Pike Rule:** 2 (Measure)
- **Current state:** Tool calls are logged to transcripts and the dashboard event log, but there is no structured tracking of success/failure rates, latency, or quality scores. When a tool fails, we see it in stderr but don't aggregate patterns.
- **Target state:** Every tool call is recorded with outcome (success/error), latency (ms), and optional quality signal. A `/api/tool-stats` endpoint exposes aggregated metrics. We can answer "which tools fail most?" and "what's our p95 latency?" before changing anything.
- **Implementation steps:**
  1. Add a `ToolCallRecord` type: `{ tool, args, outcome, latencyMs, timestamp, errorType? }`
  2. Instrument the tool dispatch path in `mcp-tools.ts` to capture start/end timestamps and outcomes
  3. Store records in a SQLite table (same DB as memory index, or a separate metrics DB)
  4. Add `/api/tool-stats` endpoint to dashboard-server returning aggregated stats (last 24h, 7d)
  5. Add a `tool_stats` MCP tool so Caul can self-inspect performance
- **Priority:** High — this is the foundation for every other optimization decision

### 1.2 Memory Retrieval Quality Baseline

- **Pike Rule:** 2 (Measure)
- **Current state:** Memory search uses hybrid vector+FTS scoring with configurable weights (0.7/0.3), temporal decay, MMR reranking, and dream scoring. These parameters were set based on intuition and one bug fix (minScore lowered from 0.3 to 0.1). No systematic evaluation of retrieval quality exists.
- **Target state:** A "golden test set" of query-expected_result pairs validates that memory retrieval returns relevant results. Run periodically (daily or on config change) and report recall/precision.
- **Implementation steps:**
  1. Create `tests/memory-golden.json` with 20-30 query/expected-path pairs from real usage
  2. Write a test harness that runs each query against the live index and scores hit rate
  3. Add to CI or a daily timer so regressions are caught before they compound
  4. Use results to tune vectorWeight, ftsWeight, minScore, and MMR lambda with data, not intuition
- **Priority:** High — the video explicitly calls out baselining LLM/agent response quality before making changes

### 1.3 Compaction Quality Measurement

- **Pike Rule:** 2 (Measure)
- **Current state:** CompactionManager counts compactions and tracks whether the event loop restarts afterward, but does not measure what information is preserved or lost across compaction boundaries. We have no way to know if compaction is working well.
- **Target state:** After each compaction, run a "continuity check" — can the post-compaction agent answer basic questions about what was happening pre-compaction? Track a continuity score over time.
- **Implementation steps:**
  1. Before compaction, auto-generate 3-5 factual questions about the current session (from checkpoint data)
  2. After compaction, include these as a self-test in the post-compact injection
  3. Log whether the agent can answer them (manual initially, automated later)
  4. Track continuity scores over time to evaluate compaction strategy changes
- **Priority:** Medium — important but harder to automate reliably

### 1.4 Fric & Frac Operational Baselines

- **Pike Rule:** 2 (Measure)
- **Current state:** No systematic measurement of restaurant operational metrics. Decisions about menu changes, staffing, and marketing campaigns are made on gut feel.
- **Target state:** Baseline the key operational numbers before making changes: average ticket time, customer wait times, staff utilization, time-to-hire, offer acceptance rate, 90-day retention.
- **Implementation steps:**
  1. Identify the 5 most impactful metrics to track (start with ticket time, covers per labor hour, daily revenue per seat)
  2. Set up simple tracking — even a spreadsheet — for 30 days to establish baselines
  3. Only then evaluate whether process changes (menu redesign, scheduling changes) improve the numbers
  4. Use mailChimpClone CRM data to baseline marketing campaign performance (open rates, redemption rates)
- **Priority:** Medium — the video emphasizes "you can't optimize what you can't measure," and this applies to operations just as much as code

---

## 2. Context Compression (Pike Rule 5)

> "Data dominates. If you've chosen the right data structures and organized things well, the algorithms will almost always be self-evident."

The video identifies context compression as the first of five hard production agent problems and maps it to Rule 5. Factory.ai tested three approaches and found their "anchored iterative summarization" — which maintains a structured, persistent summary with explicit sections that gets incrementally merged — beat both OpenAI's opaque compact endpoint and Anthropic's SDK compression (which regenerates the full summary each time, creating a "telephone game" effect across repeated cycles).

### 2.1 Adopt Anchored Iterative Summarization for Checkpoints

- **Pike Rule:** 5 (Data dominates)
- **Current state:** SessionCheckpoint captures highlights, modified files, in-progress tasks, texture, and anchor phrases. CompactionManager injects this into post-compact context alongside transcript tail and recent memory entries. However, the checkpoint is overwritten each time — not incrementally merged. Each compaction resets the summary rather than building on previous ones.
- **Target state:** Checkpoint follows Factory.ai's anchored iterative summarization pattern: maintain persistent, structured sections (session intent, file modifications, decisions made, next steps) that survive across multiple compaction cycles. New compaction summaries are merged into the existing structure rather than replacing it.
- **Implementation steps:**
  1. Restructure SessionCheckpoint to have explicit named sections: `intent`, `modifications`, `decisions`, `nextSteps`, `texture`
  2. On compaction, generate a summary of the truncated span and merge it into existing sections (append, don't replace)
  3. Cap each section at a token budget to prevent unbounded growth
  4. Persist the structured checkpoint to disk so it survives backend restarts
  5. Test across multiple compaction cycles to verify information preservation vs. the current approach
- **Priority:** High — the video presents clear evidence that incremental structured summarization outperforms regeneration

### 2.2 Milestone-Based Work Structuring

- **Pike Rule:** 5 (Data dominates)
- **Current state:** Long-running tasks are handled within a single session until compaction forces context loss. The agent dispatch system exists but is used primarily for background research, not for milestone-based work decomposition.
- **Target state:** Structure work into explicit milestones that compress cleanly. As the video states: "you have to think about your project in terms of milestones and make sure that the milestones can be compressed in ways that allow the agent to continue to work."
- **Implementation steps:**
  1. Add a `milestones` field to SessionCheckpoint — list of completed/in-progress milestones with compressed summaries
  2. When dispatching agents, define clear milestone boundaries so each agent session has a well-scoped goal
  3. On agent completion, the result is a compressed milestone summary that feeds into the parent context
  4. Document the milestone pattern in the mini-spec workflow
- **Priority:** Medium — becomes more important as tasks get longer and more complex

### 2.3 Reduce Transcript Tail Injection Size

- **Pike Rule:** 5 (Data dominates)
- **Current state:** Post-compaction injects up to 50KB of raw transcript tail. This is a brute-force approach — lots of data, but unstructured.
- **Target state:** Replace raw transcript tail with a structured summary of the recent conversation (per the anchored iterative summarization pattern). The transcript remains available on disk for reference, but the context injection is a compressed, structured representation.
- **Implementation steps:**
  1. Before compaction, generate a structured summary of the transcript tail (not just raw text)
  2. Include key exchanges, decisions, and emotional tone — not every message
  3. Reduce injection from 50KB raw to ~5KB structured summary
  4. Keep the raw transcript on disk — the agent can read it if needed for exact quotes
- **Priority:** Medium — trades token budget for better signal-to-noise ratio

---

## 3. Simplicity (Pike Rules 3-4)

> Rule 3: "Fancy algorithms are slow when your number is small. And your number is usually small."
> Rule 4: "Fancy algorithms are buggier than simple ones. Use simple algorithms for simple data structures."

The video adds a corollary for the agentic era: "Simple scales better than complex" because "we're abstracting a lot of that edge case complexity to LLMs." It also states: "It is very, very hard to debug complex agentic systems... As much as you can, simplify."

### 3.1 Architecture: Appropriately Simple (Validation)

- **Pike Rules:** 3, 4 (Simplicity)
- **Current state:** The two-process architecture (mcp-proxy.ts as thin relay + backend.ts as auto-spawned child) is clean and debuggable. When Telegram errors happen, you know it's the backend. When MCP breaks, you know it's the proxy. The speaker validates this pattern: simple architectures with clean separation make root-cause analysis possible.
- **Target state:** No change needed. This is the right architecture. Resist adding complexity.
- **Implementation steps:** None — this is a "keep doing what you're doing" item. Document it as a deliberate architectural decision so future sessions don't second-guess it.
- **Priority:** N/A — validation, not improvement

### 3.2 Memory Index: Evaluate MMR Complexity

- **Pike Rules:** 3, 4 (Simplicity)
- **Current state:** MemoryIndex includes MMR (Maximal Marginal Relevance) reranking with embedding cache, cosine similarity, and Jaccard fallback. This is a sophisticated retrieval algorithm. The actual corpus is relatively small — tens to low hundreds of markdown files.
- **Target state:** Measure whether MMR actually improves retrieval quality over simple top-K scoring (per Rule 2). If the number is small, the fancy algorithm may not justify its complexity and bug surface area.
- **Implementation steps:**
  1. Run the golden test set (from improvement 1.2) with MMR enabled vs. disabled
  2. Compare recall/precision scores
  3. If MMR doesn't measurably improve results, remove it to simplify the codebase
  4. If it does help, keep it but document the evidence
- **Priority:** Low — the current implementation works; this is an optimization/simplification opportunity

### 3.3 Dream Scoring: Evaluate Necessity

- **Pike Rules:** 3, 4 (Simplicity)
- **Current state:** MemoryIndex has dream-specific scoring: separate half-life (7 days vs. 30 days), base weight multiplier (0.5x), and pattern matching for dream content. This is a creative feature but adds complexity to every search query.
- **Target state:** Measure whether dream scoring changes search results in practice. If dream content is rarely retrieved or the scoring doesn't materially affect ranking, simplify by removing the special case.
- **Implementation steps:**
  1. Log how often dream content appears in search results (add a counter)
  2. If dream content almost never surfaces, the special scoring is dead code complexity
  3. If it does surface, validate that the 0.5x weight and 7-day half-life are the right values (measure, per Rule 2)
- **Priority:** Low — small surface area, but a good example of "don't get fancy until you know your number is large"

### 3.4 Fric & Frac: Keep Systems Staff-Debuggable

- **Pike Rules:** 3, 4 (Simplicity)
- **Current state:** The restaurant uses various operational tools (POS, scheduling, inventory). Staff turnover means systems need to be learnable quickly.
- **Target state:** Every operational system should pass the "new hire test" — can a new employee learn it in their first week? If not, it's too complex. The video states: "Simple operational processes are easier to train staff on, easier to debug when things go wrong, and easier to maintain as staff turns over."
- **Implementation steps:**
  1. Audit current operational tools for complexity vs. utility
  2. For each tool, ask: could a simpler version do 80% of the job?
  3. Don't build enterprise-grade systems for a single location — the video is explicit about this: "Don't build enterprise-grade systems for a single location."
  4. The applicant tracker spec (applicant-tracker.md) is the right level of simplicity — keep that standard
- **Priority:** Medium — directly impacts staff effectiveness and training time

---

## 4. Data Structures (Pike Rule 5)

> "Write dumb code and have smart objects in your data system."

The video cites Factory.ai's finding: "the agent isn't the broken thing — the environment is." Fix data structures (linter configs, documented builds, dev containers, agents.markdown) and agent behavior becomes self-evident. Factory's data shows this compounds: better environments make agents more productive, which frees time to make environments better.

### 4.1 CLAUDE.md as Context Graph Root

- **Pike Rule:** 5 (Data dominates)
- **Current state:** CLAUDE.md files exist at multiple levels (vault root, ClawdBot, homaruscc) and contain project-specific guidance. They serve as the entry point for Claude Code sessions. The video speaker identifies this pattern (citing "an agents.markdown file") as exactly the kind of data structure that makes agent behavior self-evident.
- **Target state:** Treat CLAUDE.md as a navigable context graph root, not just a flat document. It should point the agent to the right sub-context for any task rather than stuffing everything into one file. The video warns against "stuffing it all in the context window and hoping and praying."
- **Implementation steps:**
  1. Audit current CLAUDE.md files for stale or redundant information
  2. Ensure each CLAUDE.md links to (not duplicates) relevant specs, design docs, and config files
  3. Add a "context navigation" section that tells the agent which files to read for which types of tasks
  4. Keep the CLAUDE.md lean — it should be a map, not an encyclopedia
- **Priority:** High — this is the most direct application of "data dominates" to our workflow

### 4.2 Memory Schema: Add Structured Metadata

- **Pike Rule:** 5 (Data dominates)
- **Current state:** Memory chunks store path, chunk_index, content, and updated_at. No structured metadata (category, source type, relevance tags). The chunk is a bag of words with a timestamp.
- **Target state:** Enrich chunk metadata so the "smart data structure" enables better retrieval without fancier algorithms. Add category tags, source type, and relationship links.
- **Implementation steps:**
  1. Add `category TEXT` and `source_type TEXT` columns to the chunks table
  2. Auto-categorize on index based on file path patterns (journal/ = reflection, identity/ = self, memory/ = factual)
  3. Allow memory_store to accept optional metadata tags
  4. Use metadata for filtered search (e.g., "search only journal entries") without changing the search algorithm
- **Priority:** Medium — makes retrieval smarter through better data, not fancier code (exactly Pike Rule 5)

### 4.3 Identity Files: Keep as Smart Objects

- **Pike Rule:** 5 (Data dominates)
- **Current state:** Identity files (soul.md, user.md, state.md, preferences.md, disagreements.md) at `~/.homaruscc/identity/` provide the agent's "smart objects." They are loaded by IdentityManager and injected into context.
- **Target state:** These are already a good implementation of Rule 5. Maintain them and ensure they stay current. The speaker's framing: good data structures make the algorithms (agent behavior) self-evident.
- **Implementation steps:**
  1. Schedule periodic review of identity files for staleness (quarterly)
  2. Ensure preferences.md and disagreements.md are actively maintained — they're the "emergent" data structures that inform behavior
  3. Keep soul.md lean with the protected/evolvable boundary already established
- **Priority:** Low — already well-implemented; this is maintenance

### 4.4 Fric & Frac: Structure Customer and Employee Data

- **Pike Rule:** 5 (Data dominates)
- **Current state:** Customer data lives in mailChimpClone CRM (encrypted, CAN-SPAM compliant). Employee/applicant data is tracked via simple specs. The video says: "Get your data right — clean customer lists, organized inventory, well-structured schedules — and the operational decisions become obvious."
- **Target state:** Ensure customer data (from mailChimpClone), employee data (from applicant tracker), and operational data (schedules, inventory) are structured so that decisions about marketing, hiring, and operations are data-driven rather than intuition-driven.
- **Implementation steps:**
  1. Validate mailChimpClone customer data is clean (no duplicates, proper E.164 phone formatting, active subscription tracking)
  2. Implement the applicant tracker spec with structured stages (applied, screened, interviewed, offered, hired/rejected)
  3. Tag customer data with visit frequency and engagement level so campaigns can target appropriately
- **Priority:** Medium — foundational for data-driven operations

---

## 5. Linting & Validation (Pike Rules 3-4)

> "Strict linting puts agent-generated code in a 'straitjacket' of best practices."

The video describes Factory.ai's approach: obsessive linting rules that force code to adhere to best practices, because "the agents are by definition just trying to get the job done. They are lazy developers." Without strict linting, agent-generated code will cut corners.

### 5.1 Add ESLint with Strict Rules for Agent-Generated Code

- **Pike Rules:** 3, 4 (Simplicity via enforcement)
- **Current state:** No automated linting in the HomarUScc codebase. TypeScript compiler catches type errors, but style, complexity, and best-practice violations are not enforced.
- **Target state:** Strict ESLint config that runs on every build. When the agent generates code, the linter catches issues before they reach production. The video's framing: "if you don't have a strict linter that is going to go through and insist on simplicity, you are going to be in trouble."
- **Implementation steps:**
  1. Add `eslint` and `@typescript-eslint/eslint-plugin` to devDependencies
  2. Configure with strict rules: no-unused-vars, no-any, consistent-return, max-complexity, etc.
  3. Add `lint` script to package.json
  4. Add lint step to build process (fail on errors)
  5. Fix existing violations incrementally
- **Priority:** High — this is a force multiplier for all future code generation

### 5.2 Pre-Commit Validation for Design Traceability

- **Pike Rules:** 3, 4 (Simplicity via enforcement)
- **Current state:** The mini-spec workflow requires traceability comments (CRC/Seq references in source files), but this is enforced by convention, not automation.
- **Target state:** A pre-commit check validates that new source files include traceability comments linking to design artifacts.
- **Implementation steps:**
  1. Write a simple script that checks `src/*.ts` files for `// CRC:` or `// Seq:` comments
  2. Add as a pre-commit hook or build-time check
  3. Keep it simple — a grep-based check, not a complex AST parser (Rule 3: don't get fancy)
- **Priority:** Low — helpful for discipline but the current convention is working

---

## 6. Specification Discipline (Pike Rule 5)

> "If you are going to give an agent a context window, you have to be disciplined about making sure your context graph is really clean. So the agent can go search and get the context it needs cleanly by navigating a hierarchy rather than just stuffing it all in the context window."

The video identifies specification fatigue as the hardest of the five problems. Teams struggle with defining specs clearly upfront, and humans must "be less lazy if we want the agents to do good work for us." The speaker warns against stuffing context and advocates for clean context graphs that agents can navigate hierarchically.

### 6.1 Mini-Spec Templates: Enforce Structure

- **Pike Rule:** 5 (Data dominates)
- **Current state:** The mini-spec workflow follows an 8-phase methodology with requirements, CRC cards, and sequence diagrams. This is a good structure. However, spec quality varies — some specs are detailed, others are vague.
- **Target state:** Standardized templates for each artifact type that enforce completeness. The video warns: "you have to be very precise and crystal clear in your thinking" and "you have to be disciplined about not taking shortcuts."
- **Implementation steps:**
  1. Create templates for: spec (what), requirements (constraints), CRC card (who does what), sequence diagram (how)
  2. Each template has mandatory sections that must be filled — incomplete specs fail review
  3. Add templates to the `/mini-spec` skill so they're auto-applied
  4. Keep templates short — the goal is structure, not bureaucracy
- **Priority:** Medium — improves output quality for all future features

### 6.2 Context Graph Navigation in Design Docs

- **Pike Rule:** 5 (Data dominates)
- **Current state:** Design docs (design.md, requirements.md) list artifacts with checkbox status. Navigation requires reading the whole file to find what's relevant.
- **Target state:** Design docs include a "context graph" section that shows relationships between artifacts — which CRC cards feed which sequences, which requirements trace to which source files. The agent can navigate this graph to find exactly the context it needs.
- **Implementation steps:**
  1. Add a relationship map to design.md: `R1-R9 → crc-HomarUScc.md → seq-startup.md → src/homaruscc.ts`
  2. Keep it as a simple table or list — not a complex graph database
  3. Update the map when new artifacts are added (part of the mini-spec workflow)
- **Priority:** Medium — reduces context stuffing by enabling targeted navigation

### 6.3 Spec Review Checklist

- **Pike Rule:** 5 (Data dominates)
- **Current state:** Specs are reviewed informally during implementation.
- **Target state:** A short checklist verifies spec quality before implementation begins: Is the scope bounded? Are success criteria measurable? Are edge cases listed? Is the context graph updated?
- **Implementation steps:**
  1. Define a 5-item checklist for spec readiness
  2. Include in the mini-spec skill output
  3. Review checklist before writing any code
- **Priority:** Low — lightweight improvement to existing process

---

## 7. Multi-Agent Coordination (Pike Rule 1)

> "You can't tell where a program is going to spend its time. Bottlenecks occur in surprising places, so don't try to second guess and put in a speed hack until you've proven that's where the bottleneck is."

The video converges on the planner/executor pattern for multi-agent coordination and warns against premature optimization: "Build the simplest possible version of this agentic development pipeline, and then we can always add more value by complexifying it if we really have to." The video also describes multi-agent handoffs as the solution for long-running tasks that would otherwise fill the context window.

### 7.1 Don't Over-Architect Multi-Agent Until Measured

- **Pike Rule:** 1 (Don't premature optimize)
- **Current state:** AgentRegistry supports dispatching background agents with status tracking. The current usage is simple: dispatch for research tasks, collect results. No complex orchestration mesh.
- **Target state:** Keep it simple. The video is explicit: "Don't add multi-agent orchestration until a single agent demonstrably can't handle the workload." Only add planner/executor patterns when we can measure that a single agent is the bottleneck.
- **Implementation steps:**
  1. Track agent dispatch frequency and outcomes (per improvement 1.1)
  2. Only add orchestration complexity when data shows a single agent is the limiting factor
  3. If/when multi-agent becomes necessary, follow the planner/executor pattern (one agent plans, others execute discrete milestones)
  4. Each executor gets a fresh context window with a well-scoped milestone goal
- **Priority:** Low right now — the current simple dispatch is sufficient. Revisit when data says otherwise.

### 7.2 Agent Handoff for Context Window Management

- **Pike Rule:** 1 (Don't premature optimize) + Rule 5 (Data dominates)
- **Current state:** Long sessions hit the context window limit, trigger compaction, and lose some context. The CompactionManager handles this with pre/post-compact hooks, transcript injection, and checkpoint data.
- **Target state:** For truly long-running tasks (multi-hour or multi-day), use multi-agent handoffs where each agent handles one milestone, then dies and passes a structured summary to the next agent. The video describes this: "multi-agent frameworks that allow the agent to pick off and address big pieces of work and then die and refresh the context window."
- **Implementation steps:**
  1. Define a "handoff protocol" — structured JSON that one agent passes to the next (intent, completed work, remaining work, key decisions)
  2. Implement in the agent dispatch system — a completing agent can spawn its successor with handoff context
  3. Only use for tasks that demonstrably need it (Rule 1: measure first)
- **Priority:** Medium — useful for the longest-running tasks but don't build until needed

### 7.3 Fric & Frac Hiring: Measure Before Redesigning

- **Pike Rule:** 1 (Don't premature optimize)
- **Current state:** The hiring pipeline has specs for an applicant tracker and interview scheduler. The video warns: "Don't assume you know where the hiring funnel breaks. Track applicants through stages and find the actual dropout point before redesigning your process."
- **Target state:** Before building elaborate hiring tools, track the current pipeline manually and identify where candidates actually drop off. Then fix that specific bottleneck.
- **Implementation steps:**
  1. Track applicants through stages: applied, screened, interviewed, offered, hired/rejected
  2. After 30 days of data, identify the biggest dropout point
  3. Build tooling to address that specific bottleneck (not the whole pipeline)
  4. Don't build AI scoring or automated multi-round interviews for a few positions — the video says: "Don't build an applicant tracking system with AI scoring, multi-round automated interviews, and complex pipelines when you're hiring for a few positions."
- **Priority:** Medium — timely given the applicant tracker spec is in progress

---

## 8. Fric & Frac Operations

These improvements apply Pike's principles specifically to restaurant operations.

### 8.1 Measure Before Changing Processes

- **Pike Rule:** 2 (Measure)
- **Current state:** Menu changes, staffing decisions, and marketing campaigns are decided based on experience and intuition rather than measured baselines.
- **Target state:** Baseline current performance before making any operational change. The video says: "Before changing a menu item or process, know your current numbers."
- **Implementation steps:**
  1. Establish baseline metrics for the top 5 operational KPIs (covers, ticket time, revenue per seat, labor cost ratio, food cost ratio)
  2. Before any process change, record the baseline
  3. After the change, measure the same metrics for 30 days
  4. Keep or revert based on data, not feel
- **Priority:** High — foundational for all other Fric & Frac improvements

### 8.2 Marketing Campaign Measurement via mailChimpClone

- **Pike Rule:** 2 (Measure)
- **Current state:** mailChimpClone supports email and SMS campaigns with CAN-SPAM/TCPA compliance. Campaign effectiveness isn't systematically tracked beyond send/delivery stats.
- **Target state:** Track full funnel: send rate, open rate, click rate, redemption rate (for offers), and revenue attribution. The CRM data structure supports this — use it.
- **Implementation steps:**
  1. Add redemption tracking to campaigns (coupon codes, offer mentions at POS)
  2. Compare campaign types (email vs. SMS, different offers) by redemption rate
  3. Use the baseline to optimize future campaigns — what actually drives customers through the door?
- **Priority:** Medium — the infrastructure exists; the measurement discipline is what's missing

### 8.3 Keep Operational Tools Simple

- **Pike Rules:** 3, 4 (Simplicity)
- **Current state:** Various tools are in use or being built (POS, scheduling, social media bot, marketing platform, applicant tracker).
- **Target state:** Each tool should pass two tests: (1) Can a new hire learn it in a week? (2) Can the manager debug it without calling tech support? The video explicitly warns: "Don't build enterprise-grade systems for a single location" and "Simple operational processes are easier to train staff on, easier to debug when things go wrong, and easier to maintain as staff turns over."
- **Implementation steps:**
  1. Audit each operational tool against the two-test criteria
  2. Prefer lightweight tools (spreadsheets, simple trackers) over complex platforms for a single location
  3. The Fric-and-Frac-social-bot is a good example of appropriate simplicity — keep that standard
  4. If a tool requires a manual longer than 2 pages, it's too complex
- **Priority:** Medium — ongoing principle for all operational decisions

### 8.4 Data-Driven Menu and Scheduling

- **Pike Rule:** 5 (Data dominates)
- **Current state:** Menu decisions are made based on food trends and creative ideas (enneagram cocktails, seasonal specials). Scheduling is managed through standard restaurant tools.
- **Target state:** Structure the data so decisions become obvious. Track item-level profitability, prep time, and popularity. Structure schedules with demand data (historical covers by day/hour) so labor allocation follows the data.
- **Implementation steps:**
  1. Build a simple item profitability tracker (cost vs. price vs. volume)
  2. Track covers by day-of-week and hour to identify demand patterns
  3. Align staffing levels to demand patterns — the data tells you when you need more hands
  4. Use mailChimpClone customer data to identify which customer segments respond to which menu offerings
- **Priority:** Medium — long-term operational improvement

---

## Summary: Five Hard Problems Coverage

The video identifies five hard problems in production agent deployment. Here is how the improvements above address each:

| Hard Problem | Pike Rule | Improvements |
|---|---|---|
| **Context compression** | Rule 5 (data dominates) | 2.1 (anchored iterative summarization), 2.2 (milestone-based work), 2.3 (reduce transcript injection) |
| **Code-based instrumentation** | Rule 2 (measure) | 1.1 (tool call tracking), 1.2 (memory retrieval baseline), 1.3 (compaction quality), 1.4 (Fric & Frac baselines) |
| **Linting / static analysis** | Rules 3-4 (simplicity) | 5.1 (ESLint strict rules), 5.2 (traceability validation) |
| **Multi-agent coordination** | Rule 1 (don't premature optimize) | 7.1 (don't over-architect), 7.2 (handoff protocol), 7.3 (measure hiring funnel) |
| **Specification fatigue** | Rule 5 (data dominates) | 6.1 (mini-spec templates), 6.2 (context graph navigation), 6.3 (spec review checklist) |
