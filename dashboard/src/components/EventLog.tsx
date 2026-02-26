// CRC: crc-DashboardFrontend.md | CRC: crc-ThemeProvider.md
import { useMemo } from "react";
import { useTheme } from "../theme";
import { registerSkill, type ViewProps } from "../skills-registry";

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

// R359: EventLog with theme colors
export function EventLog({ messages }: Props) {
  const { theme } = useTheme();

  const events = useMemo(() => {
    return messages
      .filter((m) => m.type === "event")
      .map((m) => m.payload as EventData)
      .reverse();
  }, [messages]);

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, height: "100%" }}>
      <div style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${theme.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Event Log</h2>
        <span style={{
          fontSize: 11,
          color: theme.textFaint,
          background: theme.inputBg,
          padding: "2px 8px",
          borderRadius: 10,
        }}>{events.length} events</span>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "8px 20px" }}>
        {events.length === 0 && (
          <div style={{ color: theme.textFaint, fontSize: 13, textAlign: "center" as const, marginTop: 40 }}>
            No events yet
          </div>
        )}
        {events.map((event, i) => (
          <div key={`${event.id}-${i}`} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.borderSubtle}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                color: "#fff",
                background: getBadgeColor(event.type),
              }}>
                {event.type}
              </span>
              <span style={{ fontSize: 11, color: theme.textMuted }}>{event.source}</span>
              <span style={{ fontSize: 10, color: theme.textFaint, marginLeft: "auto" }}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div style={{
              fontSize: 11,
              color: theme.textFaint,
              fontFamily: "inherit",
              whiteSpace: "pre-wrap" as const,
              lineHeight: 1.4,
              maxHeight: 80,
              overflow: "hidden",
            }}>
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

// R404: Self-register as sidebar skill at module scope
registerSkill({
  id: "events",
  name: "Events",
  icon: "#",
  surface: "sidebar",
  component: EventLog as React.ComponentType<ViewProps>,
  order: 20,
  core: true,
});
