# Sequence: Memory Search

```
ClaudeCode     McpServer      McpTools      MemoryIndex    EmbeddingProvider    SQLite
    |              |              |              |                |                |
    |--CallTool--->|              |              |                |                |
    | memory_search|              |              |                |                |
    |              |--handler()-->|              |                |                |
    |              |              |--search()--->|                |                |
    |              |              |              |--embed()------>|                |
    |              |              |              |<--vector[]-----|                |
    |              |              |              |                |                |
    |              |              |              |--FTS query----------------------------->|
    |              |              |              |<--BM25 ranks---------------------------|
    |              |              |              |                |                |
    |              |              |              |--vector query-------------------------->|
    |              |              |              |<--cosine scores-------------------------|
    |              |              |              |                |                |
    |              |              |              |--combine scores                 |
    |              |              |              |--fetch updated_at for each----->|
    |              |              |              |<--timestamps--------------------|
    |              |              |              |--apply decay multiplier         |
    |              |              |              |  (skip evergreen paths)         |
    |              |              |              |--filter minScore                |
    |              |              |              |--MMR re-rank (if enabled)       |
    |              |              |              |  loop: pick best MMR score      |
    |              |              |              |  similarity: cosine or Jaccard  |
    |              |              |              |--slice to limit                 |
    |              |              |<--results----|                |                |
    |              |<--formatted--|              |                |                |
    |<--result-----|              |              |                |                |
```
