# EmbeddingProvider
**Requirements:** R36, R37

## Knows
- baseUrl: API endpoint (e.g., Ollama, OpenAI)
- model: embedding model name
- apiKey: optional API key
- dimensions: vector dimensions (default 768)

## Does
- embed: generate embedding for a single text string
- embedBatch: generate embeddings for multiple texts in one API call

## Collaborators
- MemoryIndex: provides text to embed, stores resulting vectors

## Sequences
- seq-memory-search.md
