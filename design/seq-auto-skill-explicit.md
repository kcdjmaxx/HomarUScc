# Sequence: Explicit Skill Creation (User-Initiated)

**Requirements:** R502, R507, R508, R509, R510, R520-R526, R530, R531, R532

## Trigger
User says "make this a skill", "save this as a command", or similar phrase (H3).

## Sequence

```
User: "make this a skill" / "save this as a command" (R502)
  |
  v
Detect H3: explicit request recognized (R502)
  |-- No heuristic evaluation needed; direct path
  |
  v
Identify source procedure
  |-- Option A: recent workflow in current session (tool call history)
  |-- Option B: user specifies a howto memory key
  |-- If ambiguous → ask user which procedure to capture
  |
  v
Extract Procedure (R509, R510)
  |-- Extract: name, trigger phrases, inputs, steps, outputs, gotchas
  |-- Derive steps from tool calls and parameters
  |
  v
Preview (R507, R508)
  |-- Present: proposed name, summary, trigger phrases
  |-- Show: draft SKILL.md content
  |-- "Does this look right? Any changes?"
  |-- User approves → continue
  |-- User edits → adjust and re-preview
  |
  v
AutoSkillTracker: addCandidate (status: approved) (R530, R531)
  |-- Write to auto-skills.json
  |-- Append to auto-skills-log.jsonl (R532)
  |
  v
Validate + Write + Notify
  |-- (same as seq-auto-skill-generate.md validation/write/notify steps)
  |-- Check directory exists (R520)
  |-- Check trigger collisions (R522)
  |-- mkdir + write SKILL.md (R523, R524)
  |-- memory_store (R525)
  |-- Update status to "written"
  |-- Notify user (R526)
```

## Notes

- Explicit mode skips the "pending" status -- goes directly to "approved" since user initiated.
- The preview step is interactive; user can request name changes or step adjustments.
- This flow works even when autoSkill.enabled is false (explicit always works).
