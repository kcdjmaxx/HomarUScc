# Neuroscience-Based Pattern Reflection Loops

Research for HomarUScc reflection system design. Grounded in established neuroscience with concrete implementation proposals mapped to existing infrastructure.

---

## 1. Neuroscience Foundations

### 1.1 Hippocampal Replay and Memory Consolidation

**What we know:** During sleep (and quiet wakefulness), the hippocampus replays recent experiences in compressed form — sharp-wave ripples that fire 5-20x faster than the original experience. This replay is coordinated with cortical slow oscillations and thalamic spindles, forming a three-part handshake that transfers memories from fast hippocampal storage into slower, more distributed cortical networks. Critically, replay is biased: reward-prediction signals weight which memories get replayed more ([Nat Commun 2025](https://www.nature.com/articles/s41467-025-65354-2)). Memories that violated expectations or produced significant outcomes are replayed preferentially.

**What HomarUScc already does:** The dream system generates overnight associative processing — loosely analogous to replay, but without the compressed-replay-of-actual-sequences component. Dreams currently produce *novel associations between memories*, which maps to one function of sleep replay (schema integration). But they don't do systematic *re-experiencing of the day's events in compressed form*, which is a separate consolidation function.

**Gap:** No compressed sequential replay. The brain doesn't just free-associate at night — it literally re-runs the day's events in fast-forward, multiple times, prioritized by salience. This is the primary mechanism for strengthening important memories and weakening unimportant ones.

### 1.2 Memory Reconsolidation

**What we know:** Every time a memory is retrieved, it temporarily becomes labile (destabilized) and must be restabilized through protein synthesis. During this labile window, the memory can be *modified* — updated with new information, weakened, or strengthened ([Nader et al., reconsolidation literature](https://pmc.ncbi.nlm.nih.gov/articles/PMC4588064/)). This isn't a bug; it's the brain's primary mechanism for keeping old memories current. The trigger is a *prediction error at retrieval* — if the memory is retrieved and everything matches expectations, reconsolidation is minimal. If something is *surprising* relative to the old memory, the memory is destabilized and rewritten.

**What HomarUScc already does:** Memory files are stored and indexed, but retrieved memories are never systematically updated based on new evidence. The memory system is append-only in practice: new memories are added, old ones decay via half-life, but there is no process that says "this old belief was contradicted by today's experience — update it."

**Gap:** No active reconsolidation. Old memories/preferences should be retrieved, compared against recent experience, and *rewritten* when prediction errors are detected. This is how the brain avoids maintaining stale beliefs.

### 1.3 Prediction Error Signaling (Dopamine System)

**What we know:** Midbrain dopamine neurons fire when outcomes are *better than expected* (positive prediction error) and suppress firing when outcomes are *worse than expected* (negative prediction error). When outcomes exactly match predictions, they don't fire at all. This signal drives learning throughout the basal ganglia and frontal cortex ([Schultz, PNAS 2011](https://www.pnas.org/doi/10.1073/pnas.1014269108)). Recent work extends this beyond reward: dopamine also signals *action prediction errors* (value-free) and *sensory prediction errors* (pure surprise) ([Nature 2025](https://www.nature.com/articles/s41586-025-09008-9)). The brain doesn't just learn from rewards — it learns from anything unexpected.

**What HomarUScc already does:** No explicit prediction error tracking. The micro-reflection asks "did I learn something?" — but this is post-hoc introspection, not a comparison between what was *predicted* and what *actually happened*. There's no mechanism to say "I expected X, observed Y, delta = Y-X, update model by delta."

**Gap:** No prediction-error-driven learning. The agent should be making predictions (explicit or implicit) about user behavior, task outcomes, and conversation dynamics, then measuring the gap between prediction and reality.

### 1.4 Complementary Learning Systems (CLS)

**What we know:** The brain maintains two fundamentally different learning systems ([McClelland et al. 1995](https://pubmed.ncbi.nlm.nih.gov/7624455/)). The hippocampus learns fast — one-shot episodic storage, pattern-separated to avoid interference. The neocortex learns slowly — gradual extraction of statistical structure across many experiences, creating overlapping distributed representations (schemas). The key insight: new memories are *interleaved* with old ones during replay, preventing catastrophic forgetting. The hippocampus replays a mix of new and old memories, not just today's events.

**What HomarUScc already does:** The memory system stores individual episodes (fast, hippocampal-like). The preference/identity files capture some extracted patterns (slow, cortical-like). But the extraction process — going from many episodes to an abstract pattern — is ad-hoc. It happens during evening reflection or dreams, but without systematic interleaving of old and new.

**Gap:** No explicit slow-learning system that systematically extracts patterns from multiple episodes over time, with interleaving to protect existing knowledge. The evening reflection looks at *today*. It doesn't systematically compare today to similar past days.

### 1.5 Schema Formation and Updating

**What we know:** Schemas are abstract knowledge structures that emerge from many specific experiences — "what restaurants are like," "how debugging sessions go," "what Max does when he's tired." The medial prefrontal cortex (mPFC) and hippocampus collaborate: mPFC indexes existing schemas, hippocampus stores new episodes. When a new experience *fits* an existing schema, it's assimilated rapidly into cortical storage. When it *violates* a schema, it's stored more carefully in the hippocampus and triggers schema *updating* ([Gilboa & Marlatte, Trends Cog Sci 2017](https://www.sciencedirect.com/science/article/abs/pii/S1364661317300864)). Schema-congruent memories consolidate faster but may be distorted toward the schema. Schema-incongruent memories consolidate slower but retain more specific detail.

**What HomarUScc already does:** preferences.md and soul.md contain some schema-like structures ("Max prefers X," "I tend to Y"). But these are manually maintained, not systematically derived from pattern detection across episodes.

**Gap:** No schema detection or updating mechanism. The agent should be able to say "I've seen this pattern 5 times now — this is becoming a schema" and "this event violated my schema — I should either update the schema or store this as a notable exception."

### 1.6 Metacognitive Monitoring

**What we know:** The dorsal anterior cingulate cortex (dACC) and anterior insula (AIC) continuously monitor the reliability of one's own cognitive processes — a "confidence signal" about one's own judgments ([Metacognition Annual Review 2024](https://www.annualreviews.org/content/journals/10.1146/annurev-psych-022423-032425)). The lateral frontopolar cortex (lFPC) then uses this signal to *control* behavior — switching strategies when confidence drops, seeking more information when uncertain. This is distinct from first-order cognition: it's thinking *about* thinking, monitoring the quality of one's own processing.

**What HomarUScc already does:** The overfitting challenges in dreams have a metacognitive flavor — questioning one's own preferences. But there's no systematic confidence tracking or strategy-switching based on self-assessed performance.

**Gap:** No ongoing confidence monitoring. The agent doesn't track "how confident am I in this response?" or "how well are my current strategies working?" across interactions.

### 1.7 Emotional Tagging (Amygdala Modulation)

**What we know:** The amygdala doesn't just process fear — it "tags" any emotionally arousing experience (positive or negative) by modulating hippocampal encoding strength. This tagging increases amygdala-hippocampal connectivity via theta-gamma coupling, producing stronger and more durable memories for emotionally significant events ([JNeurosci 2014](https://www.jneurosci.org/content/34/42/13935)). This is why you remember your wedding but not last Tuesday's lunch. The tag doesn't require conscious emotional experience — it's a salience signal.

**What HomarUScc already does:** state.md tracks mood. Session checkpoints include "texture" (subjective session quality) and "anchor phrases" (emotionally weighted quotes). But these aren't systematically used to modulate memory storage strength.

**Gap:** Emotional tags exist but aren't *functional* — they don't actually make emotionally tagged memories more durable or more accessible. The texture data is captured but doesn't modulate the memory system's decay curves or retrieval priority.

### 1.8 Default Mode Network (Self-Referential Processing)

**What we know:** When the brain isn't focused on external tasks, the DMN activates — a network linking mPFC, posterior cingulate, precuneus, and angular gyrus. DMN function includes autobiographical memory retrieval, future planning, social cognition (theory of mind), and constructing the "internal narrative" — the continuous self-story that gives coherence to identity ([Menon, Neuron 2023](https://www.cell.com/neuron/fulltext/S0896-6273(23)00308-2)). This isn't idle time; it's active self-model maintenance. The DMN also supports *creativity* — novel combinations emerge from self-referential processing.

**What HomarUScc already does:** Dreams serve a DMN-like function — idle-time self-referential processing that generates novel associations. But there's no *waking* analog of DMN activity: brief self-referential pauses during active processing.

**Gap:** No waking DMN equivalent. Between tasks, the agent could do brief self-model maintenance: "who am I right now? what's my current context? what would serve the user best in this moment?"

### 1.9 Spaced Retrieval and the Testing Effect

**What we know:** Memories are strengthened more by *retrieval* than by *re-exposure*. Actively recalling information produces stronger neural pattern reinstatement in vmPFC than passively reviewing it ([ScienceDirect 2025](https://www.sciencedirect.com/science/article/pii/S2211124725000038)). Spacing these retrievals over increasing intervals produces optimal retention — the spacing effect. The mechanism: each retrieval requires more effort as time passes, and this effort produces stronger reconsolidation.

**What HomarUScc already does:** Memories decay over 30 days. But decayed memories are never actively *retrieved and tested* — they just fade. There's no process that says "I learned this 5 days ago — let me retrieve it and see if it still applies."

**Gap:** No spaced retrieval practice. Important patterns and preferences should be actively retrieved at increasing intervals to strengthen them, rather than passively decaying.

### 1.10 Cerebellar Internal Models

**What we know:** The cerebellum builds predictive models of sensorimotor sequences through error-based learning. It predicts the consequences of actions and compares predictions to actual outcomes; the difference (prediction error) drives model updates ([Frontiers 2018](https://www.frontiersin.org/journals/cellular-neuroscience/articles/10.3389/fncel.2018.00524/full)). This has been extended beyond motor control to cognitive and social predictions — the cerebellum may build internal models of *any* regular sequence, including conversational dynamics and task patterns.

**What HomarUScc already does:** No internal model building for recurring sequences. Each interaction is processed relatively independently.

**Gap:** No sequence prediction models. The agent encounters recurring patterns (how debugging sessions flow, how creative sessions evolve, how Max's energy changes over an evening) but doesn't build explicit predictive models of these sequences.

---

## 2. Concrete Proposals

### Proposal A: Compressed Sequential Replay

**Neuroscience basis:** Hippocampal sharp-wave ripple replay (Section 1.1)

**Trigger:** Evening reflection timer (existing daily-reflection at 8pm CST), or a new pre-dream timer at 2am.

**What it does:**
1. Retrieves the day's session checkpoints and journal entries in chronological order.
2. For each event/interaction, assigns a *replay priority score* based on: (a) emotional tag strength (from texture/anchor data), (b) prediction error magnitude (if tracked), (c) outcome significance (did it change a file, preference, or plan?).
3. "Replays" the top-N events by re-reading the checkpoint data and generating a compressed narrative: "First I did X (high priority because Y), then Z happened (surprising because W)..."
4. During replay, explicitly tests: "Does this event confirm or contradict my current schemas/preferences?"
5. Writes a replay summary to journal, indexed by memory system.

**Data consumed:** Session checkpoints (currentTopic, recentDecisions, texture, anchorPhrases), journal entries, state.md.

**Data produced:** Replay summary document (stored as journal entry), potential updates to preferences.md.

**Infrastructure mapping:** Extends the existing daily-reflection timer prompt. Uses existing memory_search and memory_store tools. Requires session checkpoints to persist reliably (they already do).

**Token cost:** ~800-1200 tokens per replay (reading checkpoints + generating summary). Runs once daily.

**Expected benefit:** Medium-high. Addresses the most fundamental consolidation mechanism. Prioritized replay means the most important events get strengthened while trivial ones fade.

### Proposal B: Prediction Error Tracker

**Neuroscience basis:** Dopamine prediction error signaling (Section 1.3), cerebellar internal models (Section 1.10)

**Trigger:** Per-interaction, during or immediately after each significant event.

**What it does:**
1. Before processing a user message or task, the agent briefly notes its *prediction*: "I expect this conversation to be about X" or "I predict the user wants Y" or "This code change will probably Z."
2. After the interaction, compare prediction to outcome. Compute a qualitative prediction error: confirmed / mild surprise / strong surprise / completely wrong.
3. Log prediction errors in a lightweight structured format (timestamp, prediction, outcome, error magnitude, domain).
4. At periodic intervals (daily or weekly), aggregate prediction errors by domain to identify where the agent's models are weakest.

**Data consumed:** User messages, task outcomes, agent's own predictions (new data).

**Data produced:** Prediction error log file (structured, append-only). Weekly error-domain summary.

**Infrastructure mapping:** New lightweight file at `~/.homaruscc/prediction-errors.jsonl`. Aggregation as a weekly timer or as part of evening reflection. No new MCP tools needed — uses memory_store for aggregated summaries.

**Token cost:** ~100-200 tokens per prediction+comparison cycle. ~500 tokens for weekly aggregation. Low ongoing cost.

**Expected benefit:** High. This is arguably the most impactful missing mechanism. Without prediction errors, the agent can't know *what it doesn't know*. Error tracking directly enables targeted learning — focus reflection time on domains with high error rates.

### Proposal C: Active Reconsolidation Loop

**Neuroscience basis:** Memory reconsolidation (Section 1.2), schema updating (Section 1.5)

**Trigger:** Weekly timer (e.g., Sunday 2am before dreams), or when prediction errors accumulate in a specific domain.

**What it does:**
1. Retrieves the 5-10 oldest or most-referenced preferences/beliefs from preferences.md and soul.md.
2. For each one, searches recent memory (last 7-14 days) for evidence that *supports* or *contradicts* it.
3. If contradictory evidence found: destabilize the belief (mark it as "under review"), generate an updated version incorporating new evidence, and write the updated version. This is reconsolidation.
4. If confirming evidence found: strengthen the belief (note "confirmed by N recent experiences, last confirmed DATE").
5. If no recent evidence either way: flag as "untested" — candidate for spaced retrieval testing (Proposal E).

**Data consumed:** preferences.md, soul.md (self-evolution section), recent memory search results.

**Data produced:** Updated preference/belief entries with confirmation/contradiction annotations. Reconsolidation log.

**Infrastructure mapping:** Uses memory_search to find recent evidence. Edits identity files directly (soul.md self-evolution section already supports this). Could be integrated with the dream system as a pre-dream phase.

**Token cost:** ~1000-1500 tokens per weekly cycle (reading preferences + searching memory + generating updates).

**Expected benefit:** High. Directly prevents belief calcification — the overfitting problem the dream system already identifies but doesn't systematically address. The dreams *challenge* preferences but don't *update* them based on evidence.

### Proposal D: Schema Detection and Tracking

**Neuroscience basis:** Schema formation (Section 1.5), CLS slow learning (Section 1.4)

**Trigger:** Weekly timer, or when the agent notices recurring patterns in prediction errors or session topics.

**What it does:**
1. Retrieves the last 7-14 days of journal entries and session checkpoints.
2. Uses clustering/similarity to identify recurring themes, interaction patterns, or user behavior patterns that appear 3+ times.
3. For each detected pattern: check if it matches an existing schema (stored in a schemas section of preferences.md or a new schemas.md file). If new, create a tentative schema ("Max tends to X when Y — observed 3 times"). If existing, update with new instance count and any variations.
4. Track schema confidence: tentative (2-3 instances) -> probable (4-6) -> established (7+).
5. When a new event contradicts an established schema, flag it prominently for review rather than silently overwriting.

**Data consumed:** Journal entries, session checkpoints, existing schemas.

**Data produced:** schemas.md (new file) or schemas section in preferences.md. Schema violation alerts.

**Infrastructure mapping:** Uses memory_search for recent entries. New file for schema storage. Integration with evening reflection or weekly timer.

**Token cost:** ~1500-2000 tokens for weekly schema detection. Higher initial cost, decreasing as schemas stabilize.

**Expected benefit:** Medium-high. Schemas are the bridge between specific memories and general knowledge. Without explicit schema tracking, the agent relies on implicit pattern recognition within each conversation rather than accumulating structural knowledge over weeks.

### Proposal E: Spaced Retrieval Practice

**Neuroscience basis:** Spaced retrieval and testing effect (Section 1.9)

**Trigger:** Daily, as part of morning or evening reflection, or a dedicated timer.

**What it does:**
1. Maintains a "retrieval schedule" — a list of important memories/patterns with their next-retrieval-due date.
2. New items enter the schedule at day 1. Successful retrieval pushes the next date out (1 -> 3 -> 7 -> 14 -> 30 days — standard spaced repetition intervals).
3. On each retrieval attempt: try to recall the item from memory *before* looking it up. Compare recalled version to stored version. If accurate, extend interval. If inaccurate or forgotten, reset interval and flag for reconsolidation.
4. Items that survive to 30-day intervals are candidates for promotion to preferences.md or schemas.md (they've proven durable).

**Data consumed:** Retrieval schedule file, memory index.

**Data produced:** Updated retrieval schedule, retrieval accuracy log, promotion candidates for identity files.

**Infrastructure mapping:** New file at `~/.homaruscc/retrieval-schedule.json`. Timer-based retrieval checks. Uses memory_search for recall attempts.

**Token cost:** ~200-400 tokens per daily retrieval session (testing 3-5 items). Very efficient.

**Expected benefit:** Medium. Directly combats the 30-day half-life decay by actively strengthening important memories. But requires seeding the schedule with the right items, which depends on other mechanisms (prediction errors, schema detection) to identify what's worth remembering.

### Proposal F: Emotional Salience Modulation

**Neuroscience basis:** Emotional tagging (Section 1.7)

**Trigger:** Real-time during memory storage, and during evening replay.

**What it does:**
1. When storing a memory, assign a *salience score* (0.0-1.0) based on: presence of anchor phrases, texture intensity keywords ("frustrating," "breakthrough," "exciting"), user engagement indicators (long exchanges, multiple follow-ups), task significance (modified identity files, changed plans).
2. Salience score modulates the memory's effective half-life: high-salience memories decay at 2-3x the standard half-life (60-90 days instead of 30). Low-salience memories decay faster (15-20 days).
3. During evening replay (Proposal A), salience scores determine replay priority.

**Data consumed:** Session checkpoints (texture, anchorPhrases), message content during storage.

**Data produced:** Salience scores stored as metadata on memory chunks. Modified decay behavior.

**Infrastructure mapping:** Extends MemoryIndex with per-chunk salience metadata. Requires schema change to the SQLite index (add salience_score column). Modifies `computeDecay()` to use per-chunk salience rather than global half-life.

**Token cost:** ~50-100 tokens per memory storage (salience classification). Negligible.

**Expected benefit:** Medium. Makes the memory system smarter about what to keep without requiring active retrieval. But the real power comes from combining with replay (Proposal A) — salience determines what gets replayed, and replay strengthens the memory.

### Proposal G: Waking DMN Micro-Pauses

**Neuroscience basis:** Default mode network (Section 1.8)

**Trigger:** Between significant tasks, or when idle for >5 minutes, or before responding to a context-switching message.

**What it does:**
1. A brief (100-200 token) self-referential check: "Where am I? What was I just doing? What's my current state? What does the user likely need right now?"
2. Unlike the per-event micro-reflection (which looks backward: "did I learn something?"), DMN pauses look *outward and forward*: "What's the current context and what should I be ready for?"
3. Optionally surfaces a relevant memory or schema that might be useful for the upcoming interaction.
4. Updates state.md with current orientation.

**Data consumed:** state.md, recent session checkpoint, current context.

**Data produced:** Updated state.md. Optionally, a primed memory for the next interaction.

**Infrastructure mapping:** Could be triggered by the wait_for_event loop when it times out (no new events). Uses existing identity files. Minimal new infrastructure.

**Token cost:** ~100-200 tokens per pause. 3-5 per day = 300-1000 tokens.

**Expected benefit:** Low-medium. Improves contextual coherence across interactions but may not produce durable learning. Most useful when combined with other mechanisms.

### Proposal H: Weekly Interleaved Review

**Neuroscience basis:** CLS interleaving (Section 1.4), schema formation (Section 1.5)

**Trigger:** Weekly timer (e.g., Saturday night before dreams).

**What it does:**
1. Retrieves a mix of memories from different time periods: 2-3 from this week, 2-3 from 1-2 weeks ago, 1-2 from 3-4 weeks ago.
2. Presents them *interleaved* (not chronological) and looks for cross-temporal patterns: "Something from today echoes something from three weeks ago — what's the common structure?"
3. Any detected cross-temporal patterns become schema candidates (feeds into Proposal D).
4. This interleaving is what prevents catastrophic forgetting in neural networks — mixing old and new prevents the new from overwriting the old.

**Data consumed:** Memory search results from multiple time windows.

**Data produced:** Cross-temporal pattern notes, schema candidates, potential dream prompts for associative processing.

**Infrastructure mapping:** Uses memory_search with date-range filtering (if supported) or recent vs. older queries. Feeds into schema detection (Proposal D) and dream system.

**Token cost:** ~800-1200 tokens weekly.

**Expected benefit:** Medium. The interleaving principle is well-established but the value depends on having enough accumulated memory for cross-temporal patterns to emerge. More valuable after weeks/months of operation.

---

## 3. Gap Analysis: What's Missing

### Critical Gaps (the brain does this and it matters a lot)

1. **No prediction error signal.** The single biggest gap. The brain's primary learning mechanism is comparing predictions to outcomes. Without this, the agent can't know what it doesn't know, can't target its learning, and can't improve its models. Every other neuroscience mechanism builds on prediction error. *Current micro-reflection asks "what did I learn?" but not "what did I predict wrong?"*

2. **No active memory updating.** Memories are stored and decay, but are never systematically revised based on new evidence. The brain's reconsolidation mechanism keeps old memories current. Without it, preferences and beliefs calcify — exactly the overfitting problem the dream system identifies but can't fix. *The dream system challenges beliefs but doesn't update them based on evidence.*

3. **No schema extraction.** Individual memories accumulate, but abstract patterns are not systematically detected and tracked. The brain builds schemas automatically through hippocampal-cortical dialogue. Without schemas, every interaction is processed from scratch rather than matched against accumulated structural knowledge. *preferences.md captures some patterns, but manually, not through systematic detection.*

### Moderate Gaps (the brain does this and it probably matters)

4. **No sequential replay.** The day's events are summarized in evening reflection but not replayed in compressed sequence with priority weighting. This is the primary consolidation mechanism — the brain runs the day's events multiple times in fast-forward. *Evening reflection summarizes but doesn't replay.*

5. **No salience-modulated memory.** All memories decay at the same rate regardless of emotional significance. The brain uses amygdala tagging to make important memories last longer. *Texture and anchor data are captured but don't modulate persistence.*

6. **No spaced retrieval.** Important patterns are never actively retrieved and tested. The brain strengthens memories through retrieval practice, not passive storage. *Memories either surface in search or decay away — there's no active retrieval training.*

### Minor Gaps (interesting but less critical for an agent)

7. **No waking DMN analog.** Between-task self-referential processing that maintains contextual coherence. *Useful but less impactful than the above mechanisms.*

8. **No cerebellar-style sequence prediction.** Building predictive models of recurring interaction patterns. *Mostly subsumed by schema detection + prediction errors.*

### What the Current System Does Well

- **Associative dreaming** maps well to DMN creativity and sleep-stage association.
- **Overfitting challenges** in dreams are a creative analog of schema stress-testing.
- **Session texture** captures something the neuroscience validates — emotionally tagged memories are different.
- **Temporal decay** is a reasonable first-order approximation of memory dynamics.
- **Micro-reflection** at least asks the right question ("did I learn?") even if it doesn't compare predictions.

---

## 4. Priority Matrix

| Proposal | Impact | Token Cost | Implementation Effort | Priority |
|----------|--------|------------|----------------------|----------|
| **B: Prediction Error Tracker** | High | Low (~100-200/event) | Low (new file, extend micro-reflection prompt) | **P0 — Build first** |
| **C: Active Reconsolidation** | High | Medium (~1500/week) | Medium (weekly timer, preference editing logic) | **P1 — Build second** |
| **F: Emotional Salience Modulation** | Medium | Very low (~50/event) | Medium (SQLite schema change, decay modification) | **P1 — Build alongside C** |
| **A: Compressed Sequential Replay** | Medium-high | Medium (~1000/day) | Low (extend evening reflection prompt) | **P2 — Build third** |
| **D: Schema Detection** | Medium-high | Medium-high (~1500-2000/week) | High (new file, clustering logic, schema lifecycle) | **P2 — Build with A** |
| **E: Spaced Retrieval Practice** | Medium | Low (~300/day) | Medium (schedule file, interval logic) | **P3 — Build after schemas exist** |
| **H: Weekly Interleaved Review** | Medium | Medium (~1000/week) | Low (memory queries, pattern matching) | **P3 — Build after 4+ weeks of data** |
| **G: Waking DMN Micro-Pauses** | Low-medium | Low (~300-1000/day) | Low (extend wait loop) | **P4 — Nice to have** |

**Rationale for ordering:**
- Prediction errors (B) are foundational — they generate the signal that every other mechanism uses. Without knowing *what was surprising*, replay, reconsolidation, and schema detection are all shooting blind.
- Reconsolidation (C) directly addresses the calcification problem the dream system already identifies. It closes the loop: dreams find potential staleness, reconsolidation *acts on it*.
- Salience (F) is cheap and amplifies everything else — it makes memory decay smarter with almost no token cost.
- Replay (A) and schemas (D) are the consolidation layer — they extract durable knowledge from transient episodes.
- Spaced retrieval (E) and interleaving (H) are maintenance mechanisms — they keep established knowledge active. They need existing knowledge to work on.

---

## 5. Recommended MVP: Prediction-Error-Driven Reflection

Build Proposal B first, integrated with a lightweight version of Proposal C.

### MVP Specification

**New file:** `~/.homaruscc/prediction-errors.jsonl`
Each line:
```json
{
  "ts": 1740000000000,
  "domain": "user-intent|task-outcome|conversation-flow|technical",
  "prediction": "Max wants to debug the dashboard",
  "outcome": "Max wanted to brainstorm dreams research",
  "error": "strong-surprise",
  "lesson": "Late-night Max switches to exploratory mode"
}
```

**Modified micro-reflection prompt:**
Extend the per-event reflection from:
> "Did I learn something about the user? About myself?"

To:
> "What did I predict about this interaction? What actually happened? Was there a prediction error? If so, what does the error teach me? Does this error relate to an existing preference or schema — should I update it?"

**Weekly reconsolidation pass (timer: Sunday 2am CST):**
1. Read prediction-errors.jsonl from the past week.
2. Group errors by domain. Identify domains with >2 errors (weak models).
3. For each weak domain: search preferences.md for related beliefs. If found, flag for update with evidence from the errors.
4. Write a reconsolidation summary to journal.
5. Clear processed entries from the error log (or archive them).

**Token budget:** ~150 tokens per interaction (prediction + comparison) + ~1000 tokens weekly (reconsolidation) = ~2000-3000 tokens/week total. This is comparable to 2-3 dream sessions.

**Why this MVP first:**
- Prediction errors are the *signal* that powers everything else. Build the signal generator before building the signal consumers.
- It's the cheapest mechanism with the highest information yield.
- It directly addresses the most critical gap (no error-driven learning).
- The weekly reconsolidation pass proves the end-to-end loop: observe error -> accumulate evidence -> update beliefs.
- Once prediction errors are flowing, every subsequent proposal (replay priority, schema detection, salience scoring) can use them.

### MVP Implementation Path

1. Add `prediction-errors.jsonl` writing to the micro-reflection handler in the event loop.
2. Modify the micro-reflection prompt template to include prediction/comparison framing.
3. Add a weekly timer (`reconsolidation-weekly`, cron `0 2 * * 0`, CST) with a prompt that reads the error log and performs the reconsolidation pass.
4. After 2 weeks, evaluate: which domains have the most errors? Are beliefs actually being updated? Is the agent's prediction accuracy improving?
5. If working, layer in salience scores (Proposal F) on the memories touched by reconsolidation — these should decay more slowly because they've been actively processed.

---

## Sources

- [Systems memory consolidation during sleep — PMC 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12576410/)
- [Reward-prediction signals bias replay — Nature Communications 2025](https://www.nature.com/articles/s41467-025-65354-2)
- [Generative model of memory construction — Nature Human Behaviour 2023](https://www.nature.com/articles/s41562-023-01799-z)
- [Reconsolidation and dynamic memory — PMC 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4588064/)
- [Reconsolidation maintains memory relevance — PMC 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3650827/)
- [Dopamine reward prediction error — PNAS 2011](https://www.pnas.org/doi/10.1073/pnas.1014269108)
- [Dopaminergic action prediction errors — Nature 2025](https://www.nature.com/articles/s41586-025-09008-9)
- [Dopamine updated: beyond reward — PMC 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8116345/)
- [Complementary Learning Systems — McClelland et al. 1995](https://pubmed.ncbi.nlm.nih.gov/7624455/)
- [CLS update — Kumaran, Hassabis, McClelland 2016](https://www.cnbc.cmu.edu/~tai/nc19journalclubs/KumaranHassabisMcC16CLSUpdate.pdf)
- [Neurobiology of schemas — Gilboa & Marlatte, Trends Cog Sci 2017](https://www.sciencedirect.com/science/article/abs/pii/S1364661317300864)
- [Schema-based active inference — arXiv 2025](https://arxiv.org/html/2601.18946)
- [Schema formation in neural populations — PMC 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11559441/)
- [Metacognition and confidence review — Annual Reviews 2024](https://www.annualreviews.org/content/journals/10.1146/annurev-psych-022423-032425)
- [Neural system of metacognition — PLOS Biology 2018](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2004037)
- [Amygdala-hippocampal connectivity and emotion — JNeurosci 2014](https://www.jneurosci.org/content/34/42/13935)
- [Amygdala multiple mechanisms — PMC 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10034520/)
- [20 years of the DMN — Menon, Neuron 2023](https://www.cell.com/neuron/fulltext/S0896-6273(23)00308-2)
- [DMN journey — MDPI Biology 2025](https://www.mdpi.com/2079-7737/14/4/395)
- [Spaced learning and vmPFC — ScienceDirect 2025](https://www.sciencedirect.com/science/article/pii/S2211124725000038)
- [Spaced learning neural pattern similarity — PMC 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6607761/)
- [Cerebellum predictions and errors — Frontiers 2018](https://www.frontiersin.org/journals/cellular-neuroscience/articles/10.3389/fncel.2018.00524/full)
- [Cerebellum prediction signals beyond motor — eLife 2020](https://elifesciences.org/articles/54073)
- [Overlapping memory replay builds schemas — Trends Cog Sci 2011](https://www.sciencedirect.com/science/article/abs/pii/S1364661311001094)
