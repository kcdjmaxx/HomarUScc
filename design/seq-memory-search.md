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
    |              |              |              |--filter minScore                |
    |              |              |              |--sort by combined               |
    |              |              |<--results----|                |                |
    |              |<--formatted--|              |                |                |
    |<--result-----|              |              |                |                |
```
