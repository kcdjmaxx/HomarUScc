# AutoSkillTracker (JSON file management)
**Requirements:** R527, R528, R529, R530, R531, R532, R533, R534, R535

## Knows
- candidatesPath: `~/.homaruscc/auto-skills.json`
- eventLogPath: `~/.homaruscc/auto-skills-log.jsonl`
- configPath: `~/.homaruscc/config.json` (autoSkill section)
- staleThreshold: 30 days with 0 triggers
- statusTransitions: pending -> approved/declined, approved -> written

## Does
- addCandidate(record): void -- Appends new candidate to auto-skills.json (R530, R531)
- updateStatus(name, newStatus): void -- Transitions status with validation (R533)
- incrementTrigger(name): void -- Bumps triggerCount and updates lastTriggered (R527)
- flagStale(): name[] -- Returns skills with 0 triggers after 30 days (R528)
- appendLog(event): void -- Writes event to JSONL log (R532)
- isEnabled(): boolean -- Reads autoSkill.enabled from config (R534, R535)

## Collaborators
- AutoSkillDetector: calls addCandidate when detection fires
- AutoSkillGenerator: calls updateStatus on approval/write
- Bash tool: reads/writes JSON files
- config.json: provides enabled flag

## Sequences
- seq-auto-skill-generate.md (status transitions)

## Notes
All data operations use Bash/Read/Write tools to manipulate JSON files directly.
No backend TypeScript code (R539, R540). Never auto-deletes skills (R529).

### Candidate Record Schema (R531)
```json
{
  "name": "string",
  "detectedAt": "ISO-8601",
  "detection": "H1|H2|H3|H4",
  "sourceHowto": "string (memory key)",
  "toolCallCount": "number",
  "status": "pending|approved|declined|written",
  "skillPath": ".claude/skills/<name>/SKILL.md",
  "triggerCount": 0,
  "lastTriggered": "ISO-8601|null"
}
```
