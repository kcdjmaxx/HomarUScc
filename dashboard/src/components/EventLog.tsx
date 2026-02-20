// CRC: crc-DashboardFrontend.md
import { useMemo } from "react";

interface WsMessage {
  type: string;
  payload: unknown;
}

interface EventData {
  id: string;
  type: string;
  source: string;
  timestamp: number;
  payload: unknown;
}

interface Props {
  messages: WsMessage[];
}

export function EventLog({ messages }: Props) {
  const events = useMemo(() => {
    return messages
      .filter((m) => m.type === "event")
      .map((m) => m.payload as EventData)
      .reverse();
  }, [messages]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Event Log</h2>
        <span style={styles.count}>{events.length} events</span>
      </div>

      <div style={styles.list}>
        {events.length === 0 && (
          <div style={styles.empty}>No events yet</div>
        )}
        {events.map((event, i) => (
          <div key={`${event.id}-${i}`} style={styles.event}>
            <div style={styles.eventHeader}>
              <span style={{
                ...styles.badge,
                background: getBadgeColor(event.type),
              }}>
                {event.type}
              </span>
              <span style={styles.source}>{event.source}</span>
              <span style={styles.time}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div style={styles.payload}>
              {JSON.stringify(event.payload, null, 2).slice(0, 300)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getBadgeColor(type: string): string {
  switch (type) {
    case "message": return "#1e40af";
    case "timer_fired": return "#92400e";
    case "tool_call": return "#065f46";
    default: return "#374151";
  }
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid #1e1e2e",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  },
  count: {
    fontSize: 11,
    color: "#6b6b80",
    background: "#1a1a24",
    padding: "2px 8px",
    borderRadius: 10,
  },
  list: {
    flex: 1,
    overflow: "auto",
    padding: "8px 20px",
  },
  empty: {
    color: "#6b6b80",
    fontSize: 13,
    textAlign: "center" as const,
    marginTop: 40,
  },
  event: {
    padding: "10px 0",
    borderBottom: "1px solid #1a1a24",
  },
  eventHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 4,
    color: "#fff",
  },
  source: {
    fontSize: 11,
    color: "#8888a0",
  },
  time: {
    fontSize: 10,
    color: "#555568",
    marginLeft: "auto",
  },
  payload: {
    fontSize: 11,
    color: "#6b6b80",
    fontFamily: "inherit",
    whiteSpace: "pre-wrap" as const,
    lineHeight: 1.4,
    maxHeight: 80,
    overflow: "hidden",
  },
};
