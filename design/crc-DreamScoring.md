# DreamScoring (extension to MemoryIndex)
**Requirements:** R115, R116, R117, R123
**Refs:** ref-dreams-brainstorm

## Knows
- dreamPatterns: string[] — path patterns that identify dream-origin content (default `["dreams/"]`)
- dreamHalfLifeDays: number — decay half-life for dream content (default 7)
- dreamBaseWeight: number — base weight multiplier for dream results (default 0.5)

## Does
- isDreamContent(path): boolean — checks if a path matches any dream pattern (prefix match)
- computeDecay(updatedAt, path): number — extended to apply dreamHalfLifeDays for dream paths instead of global halfLifeDays
- applyDreamWeight(score, path): number — multiplies score by dreamBaseWeight for dream-origin paths
- setDreamConfig(config): void — updates dream scoring parameters at runtime

## Collaborators
- MemoryIndex: integrated directly into the existing search scoring pipeline

## Sequences
- seq-dream-cycle.md
- seq-memory-search.md (existing — dream scoring is part of the search pipeline)
