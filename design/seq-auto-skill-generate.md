# Sequence: Auto-Skill Generation Pipeline

**Requirements:** R505, R506, R508, R509, R510, R511-R519, R520, R521, R522, R523, R524, R525, R526, R531, R533

## Trigger
User confirms skill creation after detection prompt (from seq-auto-skill-detect.md) or explicit request (from seq-auto-skill-explicit.md).

## Sequence

```
User confirms: "yes, create it"
  |
  v
AutoSkillTracker: updateStatus(name, "approved") (R533)
  |-- Update auto-skills.json
  |-- Append status change to auto-skills-log.jsonl
  |
  v
Extract Procedure (R509, R510)
  |-- Review tool calls from the source workflow
  |-- Extract: name, trigger phrases, inputs, steps, outputs, gotchas
  |-- Derive steps from actual tool names and parameters
  |
  v
Generate SKILL.md (R511-R519)
  |-- Render frontmatter: name, description (agent-first, R516)
  |-- Render usage section: trigger phrases (R512)
  |-- Render how-it-works: numbered steps with tool refs (R513, R518)
  |-- Render gotchas section (R514)
  |-- Render origin section: source howto/session ref (R515)
  |-- Verify: under 150 lines (R517), no speculative features (R519)
  |
  v
Validate (R520, R521, R522)
  |-- Glob: check .claude/skills/<name>/ exists
  |-- If exists → show both versions, ask user (R521)
  |     |-- User picks "replace" → proceed
  |     |-- User picks "keep existing" → abort, status stays approved
  |-- Scan existing skills for trigger phrase collisions (R522)
  |-- If collision → warn user, ask to proceed or rename
  |
  v
Write and Register (R523, R524, R525, R526)
  |-- Bash: mkdir -p .claude/skills/<name>/
  |-- Write: .claude/skills/<name>/SKILL.md
  |-- memory_store: log as local/skills/<name> with creation metadata
  |-- AutoSkillTracker: updateStatus(name, "written") (R533)
  |-- Append write event to auto-skills-log.jsonl
  |
  v
Notify User (R526)
  |-- "Created .claude/skills/<name>/SKILL.md"
  |-- "Skill will activate on next Claude Code restart"
  |
  v
Continue event loop
```

## Notes

- The entire pipeline runs within a single Claude Code conversation turn.
- If user declines at any validation prompt, status remains "approved" (can retry later).
- The generated SKILL.md content is shown to the user as a preview before the write step.
