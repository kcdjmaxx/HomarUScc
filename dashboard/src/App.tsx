// CRC: crc-DashboardFrontend.md | Seq: seq-event-flow.md
import { useState, useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { Sidebar } from "./components/Sidebar";
import { Chat } from "./components/Chat";
import { EventLog } from "./components/EventLog";
import { StatusPanel } from "./components/StatusPanel";
import { MemoryBrowser } from "./components/MemoryBrowser";

type View = "chat" | "events" | "status" | "memory";

const wsUrl = `ws://${window.location.hostname}:${window.location.port || 3120}`;

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

export function App() {
  const [view, setView] = useState<View>("chat");
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const { connected, messages, send } = useWebSocket(wsUrl);

  // Close sidebar on mobile when view changes
  const handleViewChange = (v: View) => {
    setView(v);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div style={styles.container}>
      {/* Mobile hamburger */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={styles.hamburger}
          aria-label="Open menu"
        >
          &#9776;
        </button>
      )}

      {/* Sidebar overlay backdrop on mobile */}
      {isMobile && sidebarOpen && (
        <div
          style={styles.backdrop}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {sidebarOpen && (
        <Sidebar
          view={view}
          onViewChange={handleViewChange}
          connected={connected}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <main style={styles.main}>
        {view === "chat" && <Chat messages={messages} send={send} />}
        {view === "events" && <EventLog messages={messages} />}
        {view === "status" && <StatusPanel messages={messages} send={send} />}
        {view === "memory" && <MemoryBrowser send={send} messages={messages} />}
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    background: "#0a0a0f",
    color: "#e0e0e8",
    position: "relative" as const,
  } as const,
  main: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
  } as const,
  hamburger: {
    position: "fixed" as const,
    top: 12,
    left: 12,
    zIndex: 100,
    background: "#1e1e2e",
    border: "1px solid #2a2a3e",
    borderRadius: 8,
    color: "#c4b5fd",
    fontSize: 20,
    padding: "6px 10px",
    cursor: "pointer",
    fontFamily: "inherit",
  } as const,
  backdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 199,
  } as const,
};
