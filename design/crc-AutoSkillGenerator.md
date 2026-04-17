# AutoSkillGenerator (skill prompt logic)
**Requirements:** R505, R506, R507, R508, R509, R510, R511, R512, R513, R514, R515, R516, R517, R518, R519, R520, R521, R522, R523, R524, R525, R526

## Knows
- skillTemplate: SKILL.md structure (frontmatter, usage, how-it-works, gotchas, origin)
- maxLines: 150-line limit for generated SKILL.md files
- skillsDir: `.claude/skills/<name>/` output path
- extractionFields: name, trigger phrases, inputs, steps, outputs, gotchas

## Does
- extractProcedure(workflow): ProcedureRecord -- Extracts name, triggers, inputs, steps, outputs, gotchas from tool call history (R509, R510)
- generateSkillMd(procedure): string -- Renders SKILL.md with all required sections (R511-R519)
- validateUniqueness(name, triggers): conflicts[] -- Checks for directory and trigger phrase collisions (R520, R521, R522)
- promptUser(candidate): approved | declined -- Shows name + summary, awaits confirmation (R505, R506, R507, R508)
- writeSkill(name, content): void -- Creates directory, writes SKILL.md, logs to memory (R523, R524, R525)
- notifyUser(skillPath): void -- Confirms creation and restart requirement (R526)

## Collaborators
- AutoSkillDetector: provides detected candidates
- AutoSkillTracker: updates status (approved/declined/written)
- memory_store MCP tool: logs skill creation as `local/skills/<name>` memory
- Bash tool: creates directories, writes files
- Glob tool: checks for existing skill directories

## Sequences
- seq-auto-skill-generate.md
- seq-auto-skill-explicit.md

## Notes
This is a prompt CRC. The generation pipeline runs entirely within Claude Code's conversation
context using existing MCP tools and file tools. No backend code involved (R539, R540).
