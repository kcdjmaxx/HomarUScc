import { useMemo, useEffect } from "react";

interface WsMessage {
  type: string;
  payload: unknown;
}

interface StatusData {
  state: string;
  queue: { size: number };
  channels: Record<string, { healthy: boolean; message?: string }>;
  skills: Array<{ name: string; state: string }>;
  memory: { fileCount: number; chunkCount: number; indexedPaths: string[] };
  timers: number;
  eventHistory: number;
}

interface Props {
  messages: WsMessage[];
  send: (type: string, payload: unknown) => void;
}

export function StatusPanel({ messages, send }: Props) {
  const status = useMemo(() => {
    const statusMsgs = messages.filter((m) => m.type === "status");
    if (statusMsgs.length === 0) return null;
    return statusMsgs[statusMsgs.length - 1].payload as StatusData;
  }, [messages]);

  useEffect(() => {
    send("status", {});
    const interval = setInterval(() => send("status", {}), 5000);
    return () => clearInterval(interval);
  }, [send]);

  if (!status) {
    return <div style={styles.loading}>Loading status...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>System Status</h2>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Loop State</div>
          <div style={{
            ...styles.cardValue,
            color: status.state === "running" ? "#4ade80" : "#f87171",
          }}>
            {status.state}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Event Queue</div>
          <div style={styles.cardValue}>{status.queue.size}</div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Timers</div>
          <div style={styles.cardValue}>{status.timers}</div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Event History</div>
          <div style={styles.cardValue}>{status.eventHistory}</div>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Channels</h3>
        {Object.entries(status.channels).map(([name, ch]) => (
          <div key={name} style={styles.row}>
            <span style={{
              ...styles.dot,
              background: ch.healthy ? "#4ade80" : "#f87171",
            }} />
            <span style={styles.label}>{name}</span>
            <span style={styles.detail}>{ch.message || (ch.healthy ? "healthy" : "unhealthy")}</span>
          </div>
        ))}
        {Object.keys(status.channels).length === 0 && (
          <div style={styles.none}>No channels configured</div>
        )}
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Memory</h3>
        <div style={styles.row}>
          <span style={styles.label}>Files</span>
          <span style={styles.detail}>{status.memory.fileCount}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Chunks</span>
          <span style={styles.detail}>{status.memory.chunkCount}</span>
        </div>
        {status.memory.indexedPaths.map((p, i) => (
          <div key={i} style={styles.row}>
            <span style={styles.label}>Path</span>
            <span style={styles.detail}>{p}</span>
          </div>
        ))}
      </div>

      {status.skills.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Skills</h3>
          {status.skills.map((s, i) => (
            <div key={i} style={styles.row}>
              <span style={{
                ...styles.dot,
                background: s.state === "running" ? "#4ade80" : "#facc15",
              }} />
              <span style={styles.label}>{s.name}</span>
              <span style={styles.detail}>{s.state}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    height: "100%",
    overflow: "auto",
    padding: "16px 20px",
  },
  loading: {
    color: "#6b6b80",
    padding: 40,
    textAlign: "center" as const,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    marginBottom: 24,
  },
  card: {
    background: "#14141e",
    border: "1px solid #1e1e2e",
    borderRadius: 8,
    padding: "12px 16px",
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: "#6b6b80",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 700,
    color: "#c4b5fd",
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#8888a0",
    margin: "0 0 8px",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
    fontSize: 13,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  },
  label: {
    color: "#e0e0e8",
    minWidth: 80,
  },
  detail: {
    color: "#6b6b80",
  },
  none: {
    color: "#555568",
    fontSize: 12,
    fontStyle: "italic" as const,
  },
};
