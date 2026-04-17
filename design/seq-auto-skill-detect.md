# Sequence: Auto-Skill Detection During Reflection

**Requirements:** R500, R501, R503, R504, R536, R538

## Trigger
Event loop reflection step 4 (procedural narration) completes, having stored a new `local/howto/*` memory.

## Sequence

```
Reflection Step 4 completes (howto memory stored)
  |
  v
homaruscc SKILL.md: check autoSkill.enabled in config (R535)
  |-- Read ~/.homaruscc/config.json
  |-- if disabled: skip detection, continue event loop
  |
  v
H1: Complexity Check (R500)
  |-- Count tool calls from this event's workflow
  |-- If 5+ calls toward single goal: candidate detected
  |
  v
H2: Recurrence Check (R501)
  |-- memory_search: keywords from the new howto, filter local/howto/*
  |-- If 2+ existing howtos match: candidate detected
  |
  v
H4: Similarity Check (R503)
  |-- memory_search: full text of new howto
  |-- Compare top result similarity score
  |-- If >0.7 and different key: candidate detected
  |
  v
Evaluate (R504)
  |-- Any heuristic matched?
  |-- No  → continue event loop (no candidate)
  |-- Yes → build candidate record
  |
  v
AutoSkillTracker: addCandidate(record)
  |-- Read ~/.homaruscc/auto-skills.json
  |-- Append new candidate (status: pending)
  |-- Write updated file
  |-- Append to ~/.homaruscc/auto-skills-log.jsonl
  |
  v
Prompt user (R505, R508)
  |-- "I noticed [name] could be a reusable skill. [summary]. Create it?"
  |-- User confirms → seq-auto-skill-generate.md
  |-- User declines → updateStatus(name, "declined"), continue event loop
```

## Notes

- H3 (explicit request) is not part of this sequence -- see seq-auto-skill-explicit.md.
- Heuristics are evaluated independently; short-circuits on first match for efficiency.
- Detection adds ~2 memory_search calls per reflection; acceptable overhead.
