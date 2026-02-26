// CRC: crc-DashboardFrontend.md | CRC: crc-ThemeProvider.md | CRC: crc-ViewRegistry.md | Seq: seq-event-flow.md | Seq: seq-view-registration.md
import { useState, useEffect, useMemo } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { ThemeProvider, useTheme } from "./theme";
import { Sidebar } from "./components/Sidebar";
import { getSidebarSkills, getDefaultViewId } from "./skills-registry";

// R404: Import all sidebar skill files to trigger self-registration
import "./components/Chat";
import "./components/EventLog";
import "./components/StatusPanel";
import "./components/MemoryBrowser";
import "./components/KanbanView";
import "./components/CrmView";
import "./components/SpacesView";
import "./components/AppsView";

const wsUrl = `ws://${window.location.hostname}:${window.location.port || 3120}`;
const apiBase = `http://${window.location.hostname}:${window.location.port || 3120}`;

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

// R351: App wrapped in ThemeProvider
export function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

// R356, R410, R411: Use theme colors, registry-driven view switching
function AppInner() {
  const [view, setView] = useState<string>(getDefaultViewId());
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const { connected, messages, send } = useWebSocket(wsUrl);
  const { theme } = useTheme();
  // R409: Skills config from backend — maps skill id to enabled/disabled
  const [skillsConfig, setSkillsConfig] = useState<Record<string, boolean>>({});

  // R409: Fetch skills config on startup
  useEffect(() => {
    fetch(`${apiBase}/api/config/skills`)
      .then((r) => r.json())
      .then((cfg: Record<string, boolean>) => setSkillsConfig(cfg))
      .catch(() => {});
  }, []);

  // R413: Get sidebar skills sorted by order, then filter by config
  const sidebarSkills = useMemo(() => {
    const all = getSidebarSkills();
    return all.filter((s) => {
      // R405: Core skills are always enabled
      if (s.core) return true;
      // R407: Absent keys default to enabled; only explicitly false disables
      return skillsConfig[s.id] !== false;
    });
  }, [skillsConfig]);

  // R418: If active view is disabled, fall back to default
  useEffect(() => {
    if (!sidebarSkills.find((s) => s.id === view)) {
      setView(getDefaultViewId());
    }
  }, [sidebarSkills, view]);

  const handleViewChange = (v: string) => {
    setView(v);
    if (isMobile) setSidebarOpen(false);
  };

  // R411: Resolve active component from registry
  const activeSkill = sidebarSkills.find((s) => s.id === view);
  const ActiveComponent = activeSkill?.component;

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      background: theme.bg,
      color: theme.text,
      position: "relative" as const,
    }}>
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: "fixed" as const,
            top: 12,
            left: 12,
            zIndex: 100,
            background: theme.border,
            border: `1px solid ${theme.inputBorder}`,
            borderRadius: 8,
            color: theme.accent,
            fontSize: 20,
            padding: "6px 10px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          aria-label="Open menu"
        >
          &#9776;
        </button>
      )}

      {isMobile && sidebarOpen && (
        <div
          style={{
            position: "fixed" as const,
            inset: 0,
            background: theme.overlay,
            zIndex: 199,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {sidebarOpen && (
        <Sidebar
          skills={sidebarSkills}
          activeView={view}
          onViewChange={handleViewChange}
          connected={connected}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <main style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column" as const,
      }}>
        {ActiveComponent && <ActiveComponent messages={messages} send={send} />}
      </main>
    </div>
  );
}
