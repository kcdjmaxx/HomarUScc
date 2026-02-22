// CRC: crc-DashboardFrontend.md
type View = "chat" | "events" | "status" | "memory";

interface Props {
  view: View;
  onViewChange: (v: View) => void;
  connected: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}

const items: Array<{ id: View; label: string; icon: string }> = [
  { id: "chat", label: "Chat", icon: ">" },
  { id: "events", label: "Events", icon: "#" },
  { id: "status", label: "Status", icon: "~" },
  { id: "memory", label: "Memory", icon: "@" },
];

export function Sidebar({ view, onViewChange, connected, isMobile, onClose }: Props) {
  const navStyle = isMobile
    ? { ...styles.nav, ...styles.navMobile }
    : styles.nav;

  return (
    <nav style={navStyle}>
      <div style={styles.brandRow}>
        <div style={styles.brand}>
          <div style={styles.logo}>H</div>
          <span style={styles.title}>HomarUScc</span>
        </div>
        {isMobile && onClose && (
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close menu">
            &times;
          </button>
        )}
      </div>

      <div style={styles.status}>
        <span style={{
          ...styles.dot,
          background: connected ? "#4ade80" : "#f87171",
        }} />
        <span style={styles.statusText}>{connected ? "Connected" : "Disconnected"}</span>
      </div>

      <div style={styles.menu}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            style={{
              ...styles.menuItem,
              background: view === item.id ? "#1e1e2e" : "transparent",
              color: view === item.id ? "#c4b5fd" : "#8888a0",
            }}
          >
            <span style={styles.icon}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    width: 200,
    background: "#12121a",
    borderRight: "1px solid #1e1e2e",
    display: "flex",
    flexDirection: "column" as const,
    padding: "16px 0",
  },
  navMobile: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 200,
    width: 240,
    boxShadow: "4px 0 24px rgba(0,0,0,0.5)",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px 16px",
    borderBottom: "1px solid #1e1e2e",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 28,
    height: 28,
    background: "linear-gradient(135deg, #7c3aed, #c4b5fd)",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    color: "#fff",
  },
  title: {
    fontWeight: 600,
    fontSize: 14,
    color: "#e0e0e8",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8888a0",
    fontSize: 22,
    cursor: "pointer",
    padding: "0 4px",
    fontFamily: "inherit",
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "12px 16px",
    fontSize: 11,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    display: "inline-block",
  },
  statusText: {
    color: "#8888a0",
  },
  menu: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    padding: "8px 8px",
  },
  menuItem: {
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
  },
  icon: {
    width: 16,
    textAlign: "center" as const,
    fontWeight: 700,
    fontSize: 14,
  },
};
