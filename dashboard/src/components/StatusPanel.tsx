// CRC: crc-DashboardFrontend.md | CRC: crc-ThemeProvider.md
import { useMemo, useEffect } from "react";
import { useTheme } from "../theme";
import { registerSkill, type ViewProps } from "../skills-registry";

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

// R360: StatusPanel with theme colors
export function StatusPanel({ messages, send }: Props) {
  const { theme } = useTheme();

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
    return <div style={{ color: theme.textFaint, padding: 40, textAlign: "center" as const }}>Loading status...</div>;
  }

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "16px 20px" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>System Status</h2>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
        marginBottom: 24,
      }}>
        <div style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: theme.textFaint, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            Loop State
          </div>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            marginTop: 4,
            color: status.state === "running" ? theme.success : theme.error,
          }}>
            {status.state}
          </div>
        </div>

        <div style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: theme.textFaint, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            Event Queue
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: theme.accent, marginTop: 4 }}>{status.queue.size}</div>
        </div>

        <div style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: theme.textFaint, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            Timers
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: theme.accent, marginTop: 4 }}>{status.timers}</div>
        </div>

        <div style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: theme.textFaint, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            Event History
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: theme.accent, marginTop: 4 }}>{status.eventHistory}</div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, margin: "0 0 8px", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
          Channels
        </h3>
        {Object.entries(status.channels).map(([name, ch]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", display: "inline-block", flexShrink: 0,
              background: ch.healthy ? theme.success : theme.error,
            }} />
            <span style={{ color: theme.text, minWidth: 80 }}>{name}</span>
            <span style={{ color: theme.textFaint }}>{ch.message || (ch.healthy ? "healthy" : "unhealthy")}</span>
          </div>
        ))}
        {Object.keys(status.channels).length === 0 && (
          <div style={{ color: theme.textFaint, fontSize: 12, fontStyle: "italic" as const }}>No channels configured</div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, margin: "0 0 8px", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
          Memory
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
          <span style={{ color: theme.text, minWidth: 80 }}>Files</span>
          <span style={{ color: theme.textFaint }}>{status.memory.fileCount}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
          <span style={{ color: theme.text, minWidth: 80 }}>Chunks</span>
          <span style={{ color: theme.textFaint }}>{status.memory.chunkCount}</span>
        </div>
        {status.memory.indexedPaths.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
            <span style={{ color: theme.text, minWidth: 80 }}>Path</span>
            <span style={{ color: theme.textFaint }}>{p}</span>
          </div>
        ))}
      </div>

      {status.skills.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, margin: "0 0 8px", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            Skills
          </h3>
          {status.skills.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", display: "inline-block", flexShrink: 0,
                background: s.state === "running" ? theme.success : theme.warning,
              }} />
              <span style={{ color: theme.text, minWidth: 80 }}>{s.name}</span>
              <span style={{ color: theme.textFaint }}>{s.state}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// R404: Self-register as sidebar skill at module scope
registerSkill({
  id: "status",
  name: "Status",
  icon: "~",
  surface: "sidebar",
  component: StatusPanel as React.ComponentType<ViewProps>,
  order: 30,
  core: true,
});
