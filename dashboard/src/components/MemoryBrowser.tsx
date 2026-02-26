// CRC: crc-DashboardFrontend.md | CRC: crc-ThemeProvider.md
import { useState, useMemo } from "react";
import { useTheme } from "../theme";
import { registerSkill, type ViewProps } from "../skills-registry";

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

// R361: MemoryBrowser with theme colors
export function MemoryBrowser({ send, messages }: Props) {
  const [query, setQuery] = useState("");
  const { theme } = useTheme();

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
    <div style={{ display: "flex", flexDirection: "column" as const, height: "100%" }}>
      <div style={{ padding: "16px 20px 0" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Memory Browser</h2>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "12px 20px" }}>
        <input
          style={{
            flex: 1,
            padding: "10px 14px",
            background: theme.inputBg,
            border: `1px solid ${theme.inputBorder}`,
            borderRadius: 8,
            color: theme.text,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search memory (hybrid vector + FTS)..."
        />
        <button style={{
          padding: "10px 20px",
          background: theme.buttonBg,
          color: theme.buttonText,
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
          fontFamily: "inherit",
        }} onClick={handleSearch}>
          Search
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 20px" }}>
        {results.length === 0 && (
          <div style={{ color: theme.textFaint, fontSize: 13, textAlign: "center" as const, marginTop: 40 }}>
            Enter a query to search the memory index
          </div>
        )}
        {results.map((r, i) => (
          <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid ${theme.borderSubtle}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.accent }}>{r.path}</span>
              <span style={{
                fontSize: 10,
                color: theme.textFaint,
                background: theme.inputBg,
                padding: "2px 6px",
                borderRadius: 4,
              }}>score: {r.score.toFixed(3)}</span>
            </div>
            <pre style={{
              margin: 0,
              fontSize: 11,
              color: theme.textMuted,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap" as const,
              wordBreak: "break-word" as const,
              maxHeight: 120,
              overflow: "hidden",
              fontFamily: "inherit",
            }}>{r.content.slice(0, 500)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

// R404: Self-register as sidebar skill at module scope
registerSkill({
  id: "memory",
  name: "Memory",
  icon: "@",
  surface: "sidebar",
  component: MemoryBrowser as React.ComponentType<ViewProps>,
  order: 40,
  core: false,
});
