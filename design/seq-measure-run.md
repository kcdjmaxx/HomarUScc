# Sequence: Full Measurement Run

**Trigger:** `/measure` (no args) or weekly Sunday evening timer
**Requirements:** R550-R576

## Sequence

```
User/Timer
  │
  ├─1→ ensureMetricsDir()
  │      Create ~/.homaruscc/metrics/ if missing (R576)
  │
  ├─2→ runMemory() [M1]
  │      ├─ Read ~/.homaruscc/metrics/memory-golden.json
  │      ├─ For each test case:
  │      │    ├─ Call memory_search(query=test.query)
  │      │    ├─ Check if any test.expectedKeys appear in top-N results
  │      │    └─ Record: hit (bool), rank (int or null)
  │      ├─ Compute: hitRate, meanRank, worstPerformers
  │      └─ Append timestamped entry to memory-results.jsonl (R555)
  │
  ├─3→ runSkills() [M2]
  │      ├─ Read ~/.homaruscc/auto-skills.json (registered skills)
  │      ├─ Scan session transcripts for /command invocations
  │      ├─ Count per skill: total invocations, last used date
  │      ├─ Classify: mostUsed, neverUsed, trending (increasing freq)
  │      └─ Write skill-usage.json (R559)
  │
  ├─4→ runHealth() [M3]
  │      ├─ Call get_status → uptime, compactionCount, eventCount
  │      ├─ Scan ~/.homaruscc/journal/ for session patterns
  │      ├─ Compute: avgSessionLength, compactionsPerSession, eventsPerHour
  │      └─ Write event-loop-health.json (R562)
  │
  ├─5→ runErrors() [M4]
  │      ├─ Read ~/.homaruscc/prediction-errors.jsonl
  │      ├─ Group by domain and severity
  │      ├─ Identify: commonDomains, trends, lessons
  │      └─ Write prediction-summary.json (R565)
  │
  ├─6→ writeReport()
  │      ├─ Combine M1-M4 summaries
  │      └─ Write ~/.homaruscc/metrics/report-latest.md (R574)
  │
  └─7→ Return summary to user/timer
         One-paragraph overview with key numbers
```

## Error Handling

- If golden test set is missing or empty, skip M1 with warning
- If prediction-errors.jsonl is missing, skip M4 with warning
- If get_status fails, skip M3 with warning
- Each measurement is independent — failure in one does not block others
- Report includes which measurements were skipped and why
