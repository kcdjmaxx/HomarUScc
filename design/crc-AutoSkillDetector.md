# AutoSkillDetector (skill prompt logic)
**Requirements:** R500, R501, R502, R503, R504, R536, R538

## Knows
- heuristics: four detection rules (H1-H4) evaluated independently
- complexityThreshold: 5+ tool calls toward a single goal (H1)
- recurrenceThreshold: 2+ matching `local/howto/*` memories (H2)
- similarityThreshold: >0.7 cosine similarity between howtos (H4)
- configPath: `~/.homaruscc/config.json` autoSkill.enabled flag

## Does
- detectComplexity(toolCallCount, goalDescription): boolean -- Flags when workflow exceeded 5+ tool calls for one goal (R500)
- detectRecurrence(keywords): boolean -- Searches memory for `local/howto/*` entries; flags when 2+ match (R501)
- detectExplicitRequest(userMessage): boolean -- Recognizes phrases like "make this a skill" (R502)
- detectReflectionSimilarity(newHowto): boolean -- During reflection, compares new howto against existing; flags >0.7 similarity (R503)
- evaluate(): candidate | null -- Runs all heuristics; any single match is sufficient (R504)

## Collaborators
- memory_search MCP tool: queries existing howto entries for recurrence and similarity checks
- AutoSkillTracker: receives detected candidates for persistence
- homaruscc SKILL.md: invoked during reflection step 4 (R536, R538)

## Sequences
- seq-auto-skill-detect.md

## Notes
This is a prompt CRC -- the logic lives in `.claude/skills/auto-skill/SKILL.md` as instructions
for Claude Code, not as TypeScript. Detection runs during the reflection step of the event loop.
