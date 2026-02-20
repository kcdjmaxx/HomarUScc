// Embedding providers — from HomarUS
import type { Logger } from "./types.js";
import type { EmbeddingProvider } from "./memory-index.js";

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private dims: number;
  private logger: Logger;

  constructor(options: {
    baseUrl: string;
    apiKey?: string;
    model: string;
    dimensions: number;
    logger: Logger;
  }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey ?? "";
    this.model = options.model;
    this.dims = options.dimensions;
    this.logger = options.logger;
  }

  dimensions(): number {
    return this.dims;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      return await this.requestEmbeddings(texts);
    } catch (err) {
      this.logger.debug("Batch embedding failed, falling back to sequential", { error: String(err) });
      const results: number[][] = [];
      for (const text of texts) {
        const [embedding] = await this.requestEmbeddings([text]);
        results.push(embedding);
      }
      return results;
    }
  }

  private async requestEmbeddings(input: string[]): Promise<number[][]> {
    const body = {
      model: this.model,
      input: input.length === 1 ? input[0] : input,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as EmbeddingResponse;
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  }
}

export function createEmbeddingProvider(
  config: { provider: string; model: string; baseUrl?: string; apiKey?: string; dimensions?: number },
  logger: Logger,
): EmbeddingProvider {
  const baseUrl = config.baseUrl ?? getDefaultBaseUrl(config.provider);
  const dimensions = config.dimensions ?? getDefaultDimensions(config.model);

  return new OpenAIEmbeddingProvider({
    baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    dimensions,
    logger,
  });
}

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case "ollama": return "http://127.0.0.1:11434/v1";
    case "openai": return "https://api.openai.com/v1";
    default: return `https://api.${provider}.com/v1`;
  }
}

function getDefaultDimensions(model: string): number {
  if (model.includes("nomic-embed-text")) return 768;
  if (model.includes("all-minilm")) return 384;
  if (model.includes("text-embedding-3-small")) return 1536;
  if (model.includes("text-embedding-3-large")) return 3072;
  if (model.includes("text-embedding-ada")) return 1536;
  return 768;
}
