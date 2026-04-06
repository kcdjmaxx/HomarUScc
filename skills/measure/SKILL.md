---
name: measure
description: Run baseline metrics and performance tracking for HomarUScc. Measures memory retrieval quality, skill usage, event loop health, and prediction error patterns. Produces JSON metrics and a human-readable report. TRIGGER when user says "measure", "run metrics", "check performance", "how is memory doing", "skill usage stats", "measure health". Invoked with /measure.
---

<!-- Traceability: design/crc-MeasureSkill.md, design/seq-measure-run.md, design/requirements-measure.md R550-R582 -->

# Measure

Run performance metrics against HomarUScc subsystems. Tracks memory retrieval quality, skill usage, event loop health, and prediction error patterns over time.

## Usage

```
/measure                    -- run all measurements (M1-M4)
/measure memory             -- M1: memory retrieval quality only
/measure skills             -- M2: skill usage tracking only
/measure health             -- M3: event loop health only
/measure errors             -- M4: prediction error patterns only
/measure --add-golden       -- interactively add a golden test case
/measure --history          -- show metric trends over time
```

## How It Works

Before any measurement, ensure `~/.homaruscc/metrics/` exists (create if needed).

### M1: Memory Retrieval Quality (R550-R555)

**Data source:** `~/.homaruscc/metrics/memory-golden.json` — array of test cases, each with `query`, `expectedKeys` (array of memory key prefixes), and `category`.

**Procedure:**
1. Read the golden test set. If missing or empty, warn and skip.
2. For each test case, call `memory_search` with the query.
3. Check if any of the `expectedKeys` appear (as prefix matches) in the top 5 results.
4. Record: hit (boolean), rank of first match (or null if miss).
5. Compute overall: **hitRate** (hits / total), **meanRank** (avg rank of hits), **worstPerformers** (misses and low-rank hits).
6. Append a timestamped JSON object to `~/.homaruscc/metrics/memory-results.jsonl`.

### M2: Skill Usage Tracking (R557-R559)

**Data sources:** `~/.homaruscc/auto-skills.json`, session transcripts in `~/.homaruscc/journal/`.

**Procedure:**
1. Read `auto-skills.json` for the registered skill list.
2. List all SKILL.md files under `.claude/skills/` for the full skill inventory.
3. Scan recent journal entries for `/command` invocation patterns.
4. Count invocations per skill. Identify:
   - **mostUsed**: top 5 by count
   - **neverUsed**: skills with zero invocations
   - **trending**: skills with increasing frequency in recent sessions
5. Write results to `~/.homaruscc/metrics/skill-usage.json`.

### M3: Event Loop Health (R560-R562)

**Data sources:** `get_status` tool, journal files at `~/.homaruscc/journal/`.

**Procedure:**
1. Call `get_status` to get current uptime, compaction count, and event count. If unavailable, warn and skip.
2. Scan journal files for session start/end timestamps and compaction events.
3. Compute:
   - **avgSessionLength**: mean duration across recent sessions
   - **compactionsPerSession**: total compactions / total sessions
   - **eventsPerHour**: total events / total hours of uptime
4. Write results to `~/.homaruscc/metrics/event-loop-health.json`.

### M4: Prediction Error Patterns (R563-R565)

**Data source:** `~/.homaruscc/prediction-errors.jsonl`

**Procedure:**
1. Read the JSONL file. If missing, warn and skip.
2. Parse each entry (has `domain`, `severity`, `prediction`, `actual`, `lesson` fields).
3. Group by domain, then by severity within each domain.
4. Identify:
   - **commonDomains**: domains with most errors
   - **trends**: increasing or decreasing error rates per domain
   - **lessons**: deduplicated lessons from entries
5. Write results to `~/.homaruscc/metrics/prediction-summary.json`.

### Report Generation (R574)

After all measurements complete, combine results into `~/.homaruscc/metrics/report-latest.md`:

```markdown
# HomarUScc Metrics Report — YYYY-MM-DD

## Memory Retrieval (M1)
- Hit rate: X% (N/M queries)
- Mean rank: X.X
- Worst: <list of missed queries>

## Skill Usage (M2)
- Most used: <top 5>
- Never used: <list>
- Trending: <skills gaining usage>

## Event Loop Health (M3)
- Avg session: Xh Xm
- Compactions/session: X.X
- Events/hour: X.X

## Prediction Errors (M4)
- Total errors: N
- Top domain: <domain> (N errors)
- Key lesson: <most recent lesson>
```

## --add-golden (R556, R571)

Interactive flow to add a memory retrieval test case:

1. Ask: "What query should be tested?"
2. Ask: "What memory key(s) should appear in results?" (comma-separated prefixes)
3. Ask: "Category?" (howto / preferences / solutions / technical / identity)
4. Read current `memory-golden.json`, append the new test case, write back.
5. Confirm: "Added golden test: '<query>' expecting [keys] in category <cat>"

## --history (R572)

Read `memory-results.jsonl` and display trend over last N runs:
- Hit rate over time (improving / declining / stable)
- Per-category breakdown if enough data points
- Compare latest run to baseline (first entry)

## Integration

- **Weekly timer (R577):** Schedule `measure-weekly` timer for Sunday 7pm CST. Runs full M1-M4.
- **Post-build check (R578):** After `/build` completes, run `/measure memory` to verify no regression.
- **Baseline snapshot (R579):** First run establishes the baseline. Subsequent runs compare against it.

## All Output Paths

| File | Format | Description |
|------|--------|-------------|
| `~/.homaruscc/metrics/memory-golden.json` | JSON array | Golden test set (input) |
| `~/.homaruscc/metrics/memory-results.jsonl` | JSONL | Memory quality over time |
| `~/.homaruscc/metrics/skill-usage.json` | JSON | Latest skill usage snapshot |
| `~/.homaruscc/metrics/event-loop-health.json` | JSON | Latest health snapshot |
| `~/.homaruscc/metrics/prediction-summary.json` | JSON | Latest error analysis |
| `~/.homaruscc/metrics/report-latest.md` | Markdown | Human-readable report |
