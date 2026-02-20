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
    |              |              |              |--sort by decayed score          |
    |              |              |<--results----|                |                |
    |              |<--formatted--|              |                |                |
    |<--result-----|              |              |                |                |
```
