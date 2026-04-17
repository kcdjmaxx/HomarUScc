# CRC Card: MeasureSkill

**Requirements:** R550-R582

## Responsibilities

### Knows
- Metric types: memory retrieval (M1), skill usage (M2), event loop health (M3), prediction errors (M4)
- Golden test set path: `~/.homaruscc/metrics/memory-golden.json`
- Results output dir: `~/.homaruscc/metrics/`
- Report path: `~/.homaruscc/metrics/report-latest.md`
- Append-only logs: `memory-results.jsonl`, `skill-usage.json`, `event-loop-health.json`, `prediction-summary.json`
- Default top-N for memory retrieval: 5

### Does
- **runAll()** — Execute M1-M4 in sequence, write combined report (R566)
- **runMemory()** — Load golden test set, run each query via `memory_search`, compute hit rate / mean rank / worst performers, append to `memory-results.jsonl` (R550-R555, R567)
- **runSkills()** — Parse `~/.homaruscc/auto-skills.json` and session transcripts, count invocations per skill, report most-used / never-used / trending, write `skill-usage.json` (R557-R559, R568)
- **runHealth()** — Query `get_status` API and scan journal files, compute avg session length / compactions per session / events per hour, write `event-loop-health.json` (R560-R562, R569)
- **runErrors()** — Parse `~/.homaruscc/prediction-errors.jsonl`, group by domain and severity, report common domains / trends / lessons, write `prediction-summary.json` (R563-R565, R570)
- **addGolden()** — Interactively prompt for query, expected keys, category; append to `memory-golden.json` (R556, R571)
- **showHistory()** — Read past JSONL entries, display trend lines for each metric over time (R572)
- **writeReport()** — Generate human-readable `report-latest.md` summarizing all metrics (R574)
- **ensureMetricsDir()** — Auto-create `~/.homaruscc/metrics/` if missing (R576)

## Collaborators
- `memory_search` — execute retrieval queries for M1
- `get_status` — fetch uptime, compaction count, event stats for M3
- `Bash` — read JSONL files, scan journal directory
- `Read` — load golden test set, auto-skills.json, prediction-errors.jsonl, journal files
- `Write` — output JSON results and markdown report
- `timer_schedule` — weekly Sunday evening cron (R577)
