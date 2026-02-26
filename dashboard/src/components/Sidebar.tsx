// CRC: crc-DashboardFrontend.md | CRC: crc-ThemeProvider.md | CRC: crc-ViewRegistry.md | Seq: seq-theme-toggle.md | Seq: seq-view-registration.md
import { useTheme } from "../theme";
import type { SkillRegistration } from "../skills-registry";

// R412: Sidebar receives filtered, sorted sidebar skill list from parent
interface Props {
  skills: SkillRegistration[];
  activeView: string;
  onViewChange: (v: string) => void;
  connected: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}

// R355, R357, R412: Sidebar with theme colors and registry-driven nav items
export function Sidebar({ skills, activeView, onViewChange, connected, isMobile, onClose }: Props) {
  const { theme, isDark, toggleTheme } = useTheme();

  const navBase: React.CSSProperties = {
    width: 200,
    background: theme.surface,
    borderRight: `1px solid ${theme.border}`,
    display: "flex",
    flexDirection: "column",
    padding: "16px 0",
  };

  const navMobile: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 200,
    width: 240,
    boxShadow: `4px 0 24px ${theme.shadow}`,
  };

  const navStyle = isMobile ? { ...navBase, ...navMobile } : navBase;

  return (
    <nav style={navStyle}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px 16px",
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            background: `linear-gradient(135deg, ${theme.accentSubtle}, ${theme.accent})`,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            color: "#fff",
          }}>H</div>
          <span style={{ fontWeight: 600, fontSize: 14, color: theme.text }}>HomarUScc</span>
        </div>
        {isMobile && onClose && (
          <button onClick={onClose} style={{
            background: "none",
            border: "none",
            color: theme.textMuted,
            fontSize: 22,
            cursor: "pointer",
            padding: "0 4px",
            fontFamily: "inherit",
          }} aria-label="Close menu">
            &times;
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", fontSize: 11 }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          display: "inline-block",
          background: connected ? theme.success : theme.error,
        }} />
        <span style={{ color: theme.textMuted }}>{connected ? "Connected" : "Disconnected"}</span>
      </div>

      {/* R412, R413: Render nav items from registry-derived skills list */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 2, padding: "8px 8px", flex: 1 }}>
        {skills.map((skill) => (
          <button
            key={skill.id}
            onClick={() => onViewChange(skill.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              transition: "all 0.15s",
              background: activeView === skill.id ? theme.border : "transparent",
              color: activeView === skill.id ? theme.accent : theme.textMuted,
            }}
          >
            <span style={{ width: 16, textAlign: "center" as const, fontWeight: 700, fontSize: 14 }}>{skill.icon}</span>
            {skill.name}
          </button>
        ))}
      </div>

      {/* R355, R368: Theme toggle button in sidebar footer */}
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${theme.border}` }}>
        <button
          onClick={toggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "8px 12px",
            background: "transparent",
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            color: theme.textMuted,
            fontSize: 12,
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          <span style={{ fontSize: 14 }}>{isDark ? "\u263C" : "\u263E"}</span>
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>
      </div>
    </nav>
  );
}
