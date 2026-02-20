import { useState, useMemo } from "react";

interface WsMessage {
  type: string;
  payload: unknown;
}

interface SearchResult {
  path: string;
  content: string;
  score: number;
  chunkIndex: number;
}

interface Props {
  send: (type: string, payload: unknown) => void;
  messages: WsMessage[];
}

export function MemoryBrowser({ send, messages }: Props) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const searchMsgs = messages.filter((m) => m.type === "search_results");
    if (searchMsgs.length === 0) return [];
    return searchMsgs[searchMsgs.length - 1].payload as SearchResult[];
  }, [messages]);

  const handleSearch = () => {
    if (!query.trim()) return;
    send("search", { query, limit: 20 });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Memory Browser</h2>
      </div>

      <div style={styles.searchBar}>
        <input
          style={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search memory (hybrid vector + FTS)..."
        />
        <button style={styles.searchBtn} onClick={handleSearch}>
          Search
        </button>
      </div>

      <div style={styles.results}>
        {results.length === 0 && (
          <div style={styles.empty}>
            Enter a query to search the memory index
          </div>
        )}
        {results.map((r, i) => (
          <div key={i} style={styles.result}>
            <div style={styles.resultHeader}>
              <span style={styles.path}>{r.path}</span>
              <span style={styles.score}>score: {r.score.toFixed(3)}</span>
            </div>
            <pre style={styles.content}>{r.content.slice(0, 500)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
  },
  header: {
    padding: "16px 20px 0",
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  },
  searchBar: {
    display: "flex",
    gap: 8,
    padding: "12px 20px",
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    background: "#1a1a24",
    border: "1px solid #2e2e3e",
    borderRadius: 8,
    color: "#e0e0e8",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  searchBtn: {
    padding: "10px 20px",
    background: "#7c3aed",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    fontFamily: "inherit",
  },
  results: {
    flex: 1,
    overflow: "auto",
    padding: "0 20px 20px",
  },
  empty: {
    color: "#6b6b80",
    fontSize: 13,
    textAlign: "center" as const,
    marginTop: 40,
  },
  result: {
    padding: "12px 0",
    borderBottom: "1px solid #1a1a24",
  },
  resultHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  path: {
    fontSize: 12,
    fontWeight: 600,
    color: "#c4b5fd",
  },
  score: {
    fontSize: 10,
    color: "#6b6b80",
    background: "#1a1a24",
    padding: "2px 6px",
    borderRadius: 4,
  },
  content: {
    margin: 0,
    fontSize: 11,
    color: "#8888a0",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    maxHeight: 120,
    overflow: "hidden",
    fontFamily: "inherit",
  },
};
