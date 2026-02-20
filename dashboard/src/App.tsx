import { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { Sidebar } from "./components/Sidebar";
import { Chat } from "./components/Chat";
import { EventLog } from "./components/EventLog";
import { StatusPanel } from "./components/StatusPanel";
import { MemoryBrowser } from "./components/MemoryBrowser";

type View = "chat" | "events" | "status" | "memory";

const wsUrl = `ws://${window.location.hostname}:${window.location.port || 3120}`;

export function App() {
  const [view, setView] = useState<View>("chat");
  const { connected, messages, send } = useWebSocket(wsUrl);

  return (
    <div style={styles.container}>
      <Sidebar view={view} onViewChange={setView} connected={connected} />
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
  } as const,
  main: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
  } as const,
};
